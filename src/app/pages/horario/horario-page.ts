import { Component, OnInit, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, from as rxFrom } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToolbarModule } from 'primeng/toolbar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageService, ConfirmationService } from 'primeng/api';

import { EventService } from '../../core/services/event.service';
import { EventPartService } from '../../core/services/event-part.service';
import { PersonService } from '../../core/services/person.service';
import { EventOccurrenceService } from '../../core/services/event-occurrence.service';
import { DateService } from '../../core/services/date.service';
import { Event } from '../../core/models/event.model';
import { EventPart } from '../../core/models/event-part.model';
import { Person } from '../../core/models/person.model';
import { Assignment, EventOccurrence } from '../../core/models/event-occurrence.model';

interface CalendarDay {
  date: string;
  day: number;
  occurrence: EventOccurrence | null;
}

@Component({
  selector: 'app-horario-page',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    ToastModule,
    ConfirmDialogModule,
    ToolbarModule,
    TagModule,
    TooltipModule,
    SelectButtonModule
  ],
  templateUrl: './horario-page.html'
})
export class HorarioPage implements OnInit {
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);
  private eventPartService = inject(EventPartService);
  private personService = inject(PersonService);
  private eventOccurrenceService = inject(EventOccurrenceService);
  private dateService = inject(DateService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  @ViewChild('scheduleCapture') scheduleCapture?: ElementRef<HTMLElement>;
  generatingImage = signal(false);
  imagePreviewVisible = signal(false);
  imagePreviewUrl = signal<string | null>(null);

  eventId = '';
  event = signal<Event | null>(null);
  parts = signal<EventPart[]>([]);
  people = signal<Person[]>([]);
  occurrences = signal<EventOccurrence[]>([]);
  assignmentsByOccurrence = signal<Record<string, Assignment[]>>({});
  loading = signal(false);
  autoAssigning = signal(false);
  drawingDay = signal(false);

  autoAssignDialogVisible = signal(false);
  autoAssignFromDate: Date | null = null;

  currentMonth = signal<Date>(this.dateService.today());

  weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // 'compact' = mismo calendario que 'calendar', pero sin horarios y solo con los días de la
  // semana configurados. 'sheet' = cuadro tipo Excel (partes en filas, fechas en columnas,
  // agrupado por semana). Ninguno de los dos toca la lógica de 'calendar'.
  viewMode = signal<'calendar' | 'compact' | 'sheet' | 'compact-green'>('calendar');
  viewModeOptions = [
    { label: 'Calendario', value: 'calendar', icon: 'pi pi-calendar' },
    { label: 'Compacto', value: 'compact', icon: 'pi pi-th-large' },
    { label: 'Cuadro', value: 'sheet', icon: 'pi pi-table' },
    { label: 'Verde', value: 'compact-green', icon: 'pi pi-palette' }
  ];

  // Índices (0=lunes..6=domingo) de los días de la semana que el evento realmente usa. Para
  // eventos semanales se toma directo de weekDays; para otras recurrencias se infiere de qué
  // días del mes visible tienen ocurrencias. Sirve para no mostrar columnas vacías de sábado/
  // domingo en las vistas Compacto y Cuadro.
  visibleWeekdayIndices = computed<number[]>(() => {
    const event = this.event();
    const names = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

    if (event?.recurrenceType === 'WEEKLY' && event.weekDays) {
      const active = new Set(event.weekDays.split(','));
      const indices = names.map((n, i) => i).filter(i => active.has(names[i]));
      return indices.length > 0 ? indices : [0, 1, 2, 3, 4, 5, 6];
    }

    const present = new Set<number>();
    for (const day of this.calendarDays()) {
      if (day?.occurrence) {
        present.add((this.dateService.parseIsoDate(day.date).getDay() + 6) % 7);
      }
    }
    return present.size > 0 ? [...present].sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
  });

  gridTemplateColumns = computed(() => `repeat(${this.visibleWeekdayIndices().length}, minmax(0, 1fr))`);

  // calendarDays() en bloques de 7 (semanas calendario), para poder filtrar columnas por
  // semana en las vistas Compacto y Cuadro.
  private calendarWeeks = computed<(CalendarDay | null)[][]>(() => {
    const days = this.calendarDays();
    const weeks: (CalendarDay | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return weeks;
  });

  // Semanas ya recortadas a solo las columnas de visibleWeekdayIndices(), para la vista Compacto.
  compactWeeks = computed<(CalendarDay | null)[][]>(() =>
    this.calendarWeeks().map(week => this.visibleWeekdayIndices().map(i => week[i]))
  );

  assignedFullName(eventOccurrenceId: string, eventPartId: string): string {
    const personId = this.assignedPerson(eventOccurrenceId, eventPartId);
    if (!personId) return '—';
    const person = this.people().find(p => p.personId === personId);
    return person ? `${person.firstName} ${person.lastName}`.trim() : '—';
  }

  ddmmyyyy(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // Cuadro tipo Excel, agrupado por semana: cada semana es un bloque con sus propias columnas
  // de fecha y su propia cuadrícula de celdas. Cuando una persona cubre varias partes seguidas
  // el mismo día, se fusionan en una sola celda (rowSpan) — igual que se armaría a mano en Excel.
  // Un día cancelado fusiona TODA la columna en una celda con el motivo (ej. "Feriado").
  sheetWeeks = computed(() => {
    const partsList = this.parts();
    const indices = this.visibleWeekdayIndices();

    return this.calendarWeeks()
      .map(week => {
        const columns = indices
          .map(i => week[i]?.occurrence ?? null)
          .filter((o): o is EventOccurrence => !!o);

        const grid: { render: boolean; rowSpan: number; label: string; cancelled: boolean }[][] =
          partsList.map(() => []);

        columns.forEach((occ, c) => {
          if (occ.cancelled) {
            partsList.forEach((_, r) => {
              grid[r][c] = r === 0
                ? { render: true, rowSpan: Math.max(partsList.length, 1), label: occ.cancellationReason || 'Feriado', cancelled: true }
                : { render: false, rowSpan: 0, label: '', cancelled: false };
            });
            return;
          }

          let r = 0;
          while (r < partsList.length) {
            const name = this.assignedFullName(occ.eventOccurrenceId, partsList[r].eventPartId!);
            let span = 1;
            while (
              name !== '—' &&
              r + span < partsList.length &&
              this.assignedFullName(occ.eventOccurrenceId, partsList[r + span].eventPartId!) === name
            ) {
              span++;
            }
            grid[r][c] = { render: true, rowSpan: span, label: name, cancelled: false };
            for (let k = 1; k < span; k++) {
              grid[r + k][c] = { render: false, rowSpan: 0, label: '', cancelled: false };
            }
            r += span;
          }
        });

        return { columns, grid };
      })
      .filter(week => week.columns.length > 0);
  });

  calendarDays = computed<(CalendarDay | null)[]>(() => {
    const month = this.currentMonth();
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const offset = (firstDay.getDay() + 6) % 7; // lunes = 0

    const occurrencesByDate = new Map(this.occurrences().map(o => [o.occurrenceDate, o]));

    const days: (CalendarDay | null)[] = [];

    // Días del mes anterior para rellenar la primera semana (en gris, sin ocurrencias).
    const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
    for (let i = 0; i < offset; i++) {
      const d = prevMonthLastDay - offset + 1 + i;
      const date = this.dateService.toIsoDate(new Date(year, monthIndex - 1, d));
      days.push({ date, day: d, occurrence: null });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = this.dateService.toIsoDate(new Date(year, monthIndex, d));
      days.push({ date, day: d, occurrence: occurrencesByDate.get(date) ?? null });
    }

    // Días del mes siguiente para completar la última semana (en gris, sin ocurrencias).
    const trailing = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= trailing; d++) {
      const date = this.dateService.toIsoDate(new Date(year, monthIndex + 1, d));
      days.push({ date, day: d, occurrence: null });
    }

    return days;
  });

  monthLabel = computed(() => {
    const month = new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(this.currentMonth());
    const year = new Intl.DateTimeFormat('es-PE', { year: 'numeric' }).format(this.currentMonth());
    return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
  });

  dayDialogVisible = signal(false);
  selectedDay = signal<EventOccurrence | null>(null);

  cancelDialogVisible = signal(false);
  cancellationReason = '';

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('id')!;
    this.eventService.findById(this.eventId).subscribe(e => {
      this.event.set(e);
      this.currentMonth.set(this.dateService.parseIsoDate(e.startDate));
      this.loadMonth();
    });
    this.eventPartService.findAllByEventId(this.eventId).subscribe(p => this.parts.set(p));
    this.personService.findAllByCompanyId().subscribe(p => this.people.set(p));
  }

  loadMonth(): void {
    const event = this.event();
    if (!event) return;

    const month = this.currentMonth();
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const eventStart = event.startDate ? this.dateService.parseIsoDate(event.startDate) : monthStart;
    const eventEnd = event.endDate ? this.dateService.parseIsoDate(event.endDate) : monthEnd;

    // Rango a GENERAR: acotado a la vigencia configurada del evento (no crea fechas fuera de ella).
    const generateFrom = eventStart > monthStart ? eventStart : monthStart;
    const generateTo = eventEnd < monthEnd ? eventEnd : monthEnd;

    // Rango a MOSTRAR: siempre el mes completo, para no ocultar ocurrencias ya existentes
    // (ej. si luego editas el evento y acortas su vigencia, lo ya generado sigue siendo visible).
    const monthStartIso = this.dateService.toIsoDate(monthStart);
    const monthEndIso = this.dateService.toIsoDate(monthEnd);

    this.loading.set(true);

    const loadExisting = () => {
      this.eventOccurrenceService.findAllByEventId(event.eventId!, monthStartIso, monthEndIso).subscribe({
        next: occurrences => {
          this.occurrences.set(occurrences);
          this.loading.set(false);
          this.loadAllAssignments(occurrences);
        },
        error: () => this.loading.set(false)
      });
    };

    if (generateFrom > generateTo) {
      // Este mes cae fuera de la vigencia actual del evento: no se genera nada nuevo,
      // pero igual se muestra lo que ya exista.
      loadExisting();
      return;
    }

    const fromIso = this.dateService.toIsoDate(generateFrom);
    const toIso = this.dateService.toIsoDate(generateTo);

    this.eventOccurrenceService.generate(event.eventId!, fromIso, toIso).subscribe({
      next: () => loadExisting(),
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron generar las fechas del evento' });
      }
    });
  }

  loadAllAssignments(occurrences: EventOccurrence[]): void {
    if (occurrences.length === 0) {
      this.assignmentsByOccurrence.set({});
      return;
    }
    forkJoin(occurrences.map(o => this.eventOccurrenceService.findAssignmentsByEventOccurrenceId(o.eventOccurrenceId))).subscribe(
      results => {
        const map: Record<string, Assignment[]> = {};
        occurrences.forEach((o, i) => (map[o.eventOccurrenceId] = results[i]));
        this.assignmentsByOccurrence.set(map);
      }
    );
  }

  previousMonth(): void {
    const m = this.currentMonth();
    this.currentMonth.set(new Date(m.getFullYear(), m.getMonth() - 1, 1));
    this.loadMonth();
  }

  nextMonth(): void {
    const m = this.currentMonth();
    this.currentMonth.set(new Date(m.getFullYear(), m.getMonth() + 1, 1));
    this.loadMonth();
  }

  private previewCanvas: HTMLCanvasElement | null = null;

  // Genera UNA sola imagen con el título del mes + lo que se ve en la vista activa (Calendario,
  // Compacto o Cuadro), sin los botones de navegación ni el selector de vista, y la muestra en
  // un modal de previsualización antes de descargar (como PNG o PDF).
  async previewImage(): Promise<void> {
    const target = this.scheduleCapture?.nativeElement;
    if (!target) return;

    this.generatingImage.set(true);
    try {
      // html2canvas-pro (no el html2canvas original) porque soporta los colores oklch() que
      // genera Tailwind v4 — el html2canvas normal falla al parsearlos y no genera nada.
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(target, { backgroundColor: '#ffffff', scale: 2 });
      this.previewCanvas = canvas;
      this.imagePreviewUrl.set(canvas.toDataURL('image/png'));
      this.imagePreviewVisible.set(true);
    } catch (err) {
      console.error('No se pudo generar la imagen del horario:', err);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar la imagen' });
    } finally {
      this.generatingImage.set(false);
    }
  }

  private fileBaseName(): string {
    const eventName = (this.event()?.name ?? 'evento').trim().replace(/\s+/g, '-');
    const monthSlug = this.monthLabel().replace(/\s+/g, '-');
    return `horario-${eventName}-${monthSlug}`;
  }

  downloadImagePng(): void {
    if (!this.previewCanvas) return;
    const link = document.createElement('a');
    link.download = `${this.fileBaseName()}.png`;
    link.href = this.previewCanvas.toDataURL('image/png');
    link.click();
  }

  async downloadImagePdf(): Promise<void> {
    if (!this.previewCanvas) return;
    const { jsPDF } = await import('jspdf');
    const canvas = this.previewCanvas;
    const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${this.fileBaseName()}.pdf`);
  }

  openDay(day: CalendarDay): void {
    if (!day.occurrence) return;
    this.selectedDay.set(day.occurrence);
    this.dayDialogVisible.set(true);
  }

  openOccurrence(occurrence: EventOccurrence): void {
    this.openDay({ date: occurrence.occurrenceDate, day: 0, occurrence });
  }

  assignmentsCount(eventOccurrenceId: string): number {
    return (this.assignmentsByOccurrence()[eventOccurrenceId] ?? []).length;
  }

  assignedPerson(eventOccurrenceId: string, eventPartId: string): string | null {
    const assignments = this.assignmentsByOccurrence()[eventOccurrenceId] ?? [];
    return assignments.find(a => a.eventPartId === eventPartId)?.personId ?? null;
  }

  assignmentOrigin(eventOccurrenceId: string, eventPartId: string): string | null {
    const assignments = this.assignmentsByOccurrence()[eventOccurrenceId] ?? [];
    return assignments.find(a => a.eventPartId === eventPartId)?.origin ?? null;
  }

  assignedName(eventOccurrenceId: string, eventPartId: string): string {
    const personId = this.assignedPerson(eventOccurrenceId, eventPartId);
    if (!personId) return '—';
    return this.people().find(p => p.personId === personId)?.firstName ?? '—';
  }

  abbreviatePart(name: string): string {
    const firstWord = name.trim().split(/\s+/)[0] ?? '';
    return firstWord.length <= 5 ? firstWord : firstWord.substring(0, 4) + '.';
  }

  // Si la parte tiene horario manual configurado se usa tal cual (sin restricción de tope);
  // si no, se reparte automáticamente la duración del evento en partes iguales según el
  // orden EFECTIVO de esa fecha (que puede diferir del orden base si hay un intercambio activo).
  partTimeRange(part: EventPart, date: string): string {
    if (part.startTime && part.endTime) {
      return `${part.startTime.substring(0, 5)}-${part.endTime.substring(0, 5)}`;
    }

    const event = this.event();
    const total = this.parts().length;
    if (!event || total === 0) return '';

    const start = this.timeToMinutes(event.startTime);
    const end = this.timeToMinutes(event.endTime);
    const duration = end - start;
    if (duration <= 0) return '';

    const perPart = duration / total;
    const order = this.effectiveOrder(part, date);
    const from = start + (order - 1) * perPart;
    const to = from + perPart;

    return `${this.minutesToTime(from)}-${this.minutesToTime(to)}`;
  }

  // Orden efectivo de una parte para una fecha dada: si esa parte (o la que apunta a ella)
  // tiene un intercambio configurado que incluye el día de semana de `date`, se usa el
  // sortOrder de la otra parte en su lugar. Así, "Oración Intercesora" y "Pedidos de Oración"
  // se turnan de posición (y de horario automático) solo los días que corresponda.
  effectiveOrder(part: EventPart, date: string): number {
    const dow = this.dayOfWeekIso(date);

    if (part.swapWithPartId && this.includesDay(part.swapWeekDays, dow)) {
      const other = this.parts().find(p => p.eventPartId === part.swapWithPartId);
      return other ? other.sortOrder : part.sortOrder;
    }

    const swappingPart = this.parts().find(
      p => p.swapWithPartId === part.eventPartId && this.includesDay(p.swapWeekDays, dow)
    );
    if (swappingPart) return swappingPart.sortOrder;

    return part.sortOrder;
  }

  // Partes ordenadas según su orden efectivo para la fecha dada.
  orderedPartsFor(date: string): EventPart[] {
    return [...this.parts()].sort((a, b) => this.effectiveOrder(a, date) - this.effectiveOrder(b, date));
  }

  private includesDay(weekDays: string | null | undefined, day: string): boolean {
    return !!weekDays && weekDays.split(',').includes(day);
  }

  private dayOfWeekIso(iso: string): string {
    const names = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return names[this.dateService.parseIsoDate(iso).getDay()];
  }

  // true si esta parte tiene un intercambio configurado (con otra) o es el destino del
  // intercambio de otra parte — para marcarla con un ícono en la vista Cuadro.
  partHasSwap(part: EventPart): boolean {
    return !!part.swapWithPartId || this.parts().some(p => p.swapWithPartId === part.eventPartId);
  }

  // Resumen en texto de las reglas de intercambio activas, para mostrar como leyenda.
  swapRulesSummary(): string[] {
    const dayLabel: Record<string, string> = {
      MONDAY: 'lunes', TUESDAY: 'martes', WEDNESDAY: 'miércoles',
      THURSDAY: 'jueves', FRIDAY: 'viernes', SATURDAY: 'sábado', SUNDAY: 'domingo'
    };
    return this.parts()
      .filter(p => p.swapWithPartId && p.swapWeekDays)
      .map(p => {
        const other = this.parts().find(o => o.eventPartId === p.swapWithPartId);
        const days = (p.swapWeekDays ?? '').split(',').map(d => dayLabel[d] ?? d).join(', ');
        return `${days.charAt(0).toUpperCase() + days.slice(1)}: "${p.name}" va donde "${other?.name ?? '—'}".`;
      });
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  assignManually(eventOccurrenceId: string, eventPartId: string, personId: string): void {
    this.eventOccurrenceService.assignManually({ eventOccurrenceId, eventPartId, personId }).subscribe({
      next: assignment => {
        this.assignmentsByOccurrence.update(current => {
          const list = (current[eventOccurrenceId] ?? []).filter(a => a.eventPartId !== eventPartId);
          return { ...current, [eventOccurrenceId]: [...list, assignment] };
        });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo asignar la persona' });
      }
    });
  }

  drawDay(): void {
    const occurrence = this.selectedDay();
    if (!occurrence) return;
    this.drawingDay.set(true);
    this.eventOccurrenceService.draw(occurrence.eventOccurrenceId).subscribe({
      next: assignments => {
        this.drawingDay.set(false);
        this.assignmentsByOccurrence.update(current => ({ ...current, [occurrence.eventOccurrenceId]: assignments }));
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Personas sorteadas' });
      },
      error: (err) => {
        this.drawingDay.set(false);
        const detail = err?.error?.message ?? 'No se pudo sortear';
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
      }
    });
  }

  // Abre el diálogo para elegir desde qué fecha re-sortear, por si ya se compartieron/ejecutaron
  // fechas anteriores y no se quieren mover. Por defecto propone el inicio del evento (o sea,
  // "todo"); el usuario puede adelantar la fecha para proteger lo ya hecho.
  openAutoAssignDialog(): void {
    const event = this.event();
    if (!event) return;
    this.autoAssignFromDate = event.startDate ? this.dateService.parseIsoDate(event.startDate) : this.dateService.today();
    this.autoAssignDialogVisible.set(true);
  }

  confirmAutoAssignAll(): void {
    if (!this.autoAssignFromDate) return;
    this.autoAssignDialogVisible.set(false);
    this.autoAssignAll(this.dateService.toIsoDate(this.autoAssignFromDate));
  }

  // Autoasigna el rango configurado del evento (startDate a endDate, o desde `fromDate` si se
  // especifica para no tocar fechas ya ejecutadas/compartidas) hasta endDate, no solo el mes
  // visible. Si el evento no tiene fecha fin (recurrencia indefinida), se acota a los próximos 3
  // meses desde hoy.
  autoAssignAll(fromDate?: string): void {
    const event = this.event();
    if (!event) return;

    const from = fromDate ?? event.startDate;
    const to = event.endDate ?? this.dateService.toIsoDate(this.dateService.addMonths(this.dateService.today(), 3));

    this.autoAssigning.set(true);
    this.eventOccurrenceService.generate(event.eventId!, from, to).subscribe({
      next: () => {
        this.eventOccurrenceService.findAllByEventId(event.eventId!, from, to).subscribe({
          next: allOccurrences => {
            const pending = allOccurrences.filter(o => !o.cancelled);
            if (pending.length === 0) {
              this.autoAssigning.set(false);
              this.messageService.add({ severity: 'info', summary: 'Sin fechas', detail: 'No hay fechas programadas en el rango del evento' });
              return;
            }
            // Se sortea fecha por fecha EN ORDEN (no en paralelo): la regla de "no repetir el
            // mismo grupo vinculado en menos de 7 días" necesita ver los resultados de los días
            // anteriores ya guardados antes de decidir el siguiente, así que si se lanzaran todos
            // los sorteos a la vez, ninguno vería lo que decidieron los demás en ese mismo instante.
            rxFrom(pending).pipe(
              concatMap(o => this.eventOccurrenceService.draw(o.eventOccurrenceId)),
              toArray()
            ).subscribe({
              next: () => {
                this.autoAssigning.set(false);
                this.loadMonth();
                this.messageService.add({ severity: 'success', summary: 'Listo', detail: `Se autoasignaron ${pending.length} fechas de todo el evento` });
              },
              error: () => {
                this.autoAssigning.set(false);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo autoasignar todo el evento' });
              }
            });
          },
          error: () => this.autoAssigning.set(false)
        });
      },
      error: () => {
        this.autoAssigning.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron generar las fechas del evento' });
      }
    });
  }

  openCancel(): void {
    this.cancellationReason = this.selectedDay()?.cancellationReason ?? '';
    this.cancelDialogVisible.set(true);
  }

  confirmCancel(): void {
    const occurrence = this.selectedDay();
    if (!occurrence) return;
    this.eventOccurrenceService.cancel(occurrence.eventOccurrenceId, this.cancellationReason).subscribe({
      next: updated => {
        this.cancelDialogVisible.set(false);
        this.selectedDay.set(updated);
        this.occurrences.update(list => list.map(o => (o.eventOccurrenceId === updated.eventOccurrenceId ? updated : o)));
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cancelar la fecha' });
      }
    });
  }

  reactivate(): void {
    const occurrence = this.selectedDay();
    if (!occurrence) return;
    this.confirmationService.confirm({
      message: `¿Reactivar la fecha del ${occurrence.occurrenceDate}?`,
      header: 'Confirmar',
      icon: 'pi pi-question-circle',
      accept: () => {
        this.eventOccurrenceService.reactivate(occurrence.eventOccurrenceId).subscribe({
          next: updated => {
            this.selectedDay.set(updated);
            this.occurrences.update(list =>
              list.map(o => (o.eventOccurrenceId === updated.eventOccurrenceId ? updated : o))
            );
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo reactivar' });
          }
        });
      }
    });
  }

}
