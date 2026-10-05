import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { ToolbarModule } from 'primeng/toolbar';
import { MessageService, ConfirmationService } from 'primeng/api';

import { EventService } from '../../core/services/event.service';
import { EventPartService } from '../../core/services/event-part.service';
import { PersonService } from '../../core/services/person.service';
import { PersonGroupService } from '../../core/services/person-group.service';
import { DateService } from '../../core/services/date.service';
import { Event, WEEK_DAYS, RECURRENCE_TYPES, RecurrenceType, PERSON_SELECTION_MODES, PersonSelectionMode } from '../../core/models/event.model';
import { EventPart } from '../../core/models/event-part.model';
import { Person } from '../../core/models/person.model';
import { PersonGroup } from '../../core/models/person-group.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-eventos-page',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    TooltipModule,
    DragDropModule,
    TableModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    MultiSelectModule,
    InputNumberModule,
    DatePickerModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    ToolbarModule
  ],
  providers: [],
  templateUrl: './eventos-page.html'
})
export class EventosPage implements OnInit {
  private eventService = inject(EventService);
  private eventPartService = inject(EventPartService);
  private personService = inject(PersonService);
  private personGroupService = inject(PersonGroupService);
  private dateService = inject(DateService);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  events = signal<Event[]>([]);
  loading = signal(false);
  personGroups = signal<PersonGroup[]>([]);
  allPeople = signal<Person[]>([]);
  personSelectionModes = PERSON_SELECTION_MODES;
  // Personas específicas/invitadas seleccionadas para el evento en edición (modo GROUP o SPECIFIC).
  selectedEventPeople: string[] = [];

  dialogVisible = signal(false);
  editingId = signal<string | null>(null);

  partsDialogVisible = signal(false);
  partsEvent = signal<Event | null>(null);
  parts = signal<EventPart[]>([]);
  newPartName = '';
  // Partes marcadas para vincular (checkbox activo) mientras el usuario arma el grupo.
  selectedPartIds = signal<Set<string>>(new Set());

  // Estado estable de los pickers de horario manual: se reconstruye solo al recargar partes,
  // nunca en cada ciclo de detección de cambios (si no, se pisaría lo que se está tecleando).
  editableTimes: Record<string, { start: Date | null; end: Date | null }> = {};
  // Estado estable de los días seleccionados para el intercambio de orden (mismo motivo que
  // editableTimes: un objeto plano evita crear un array nuevo en cada ciclo de detección de
  // cambios, lo que rompería el multiselect en modo zoneless).
  swapDaysState: Record<string, string[]> = {};

  editPartDialogVisible = signal(false);
  editingPart = signal<EventPart | null>(null);
  editPartNameValue = '';

  recurrenceTypes = RECURRENCE_TYPES;
  weekDayOptions = WEEK_DAYS;

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    recurrenceType: ['ONCE' as RecurrenceType, Validators.required],
    weekDays: [[] as string[]],
    dayOfMonth: [null as number | null],
    intervalDays: [null as number | null],
    startTime: [null as Date | null, Validators.required],
    endTime: [null as Date | null, Validators.required],
    startDate: [null as Date | null, Validators.required],
    endDate: [null as Date | null],
    personSelectionMode: ['ALL' as PersonSelectionMode, Validators.required],
    personGroupId: [null as string | null]
  });

  ngOnInit(): void {
    this.load();
    this.personGroupService.findAllByCompanyId().subscribe(groups => this.personGroups.set(groups));
    this.personService.findAllByCompanyId().subscribe(people => this.allPeople.set(people));
    this.form.controls.recurrenceType.valueChanges.subscribe(type => this.applyRecurrenceValidators(type));
    this.applyRecurrenceValidators(this.form.controls.recurrenceType.value);
  }

  get currentPersonSelectionMode(): PersonSelectionMode {
    return this.form.controls.personSelectionMode.value;
  }

  // Cada tipo de recurrencia exige su propio campo: días de la semana, día del mes o intervalo de días.
  private applyRecurrenceValidators(type: RecurrenceType): void {
    this.form.controls.weekDays.setValidators(type === 'WEEKLY' ? [Validators.required] : []);
    this.form.controls.dayOfMonth.setValidators(type === 'MONTHLY' ? [Validators.required] : []);
    this.form.controls.intervalDays.setValidators(type === 'EVERY_N_DAYS' ? [Validators.required] : []);
    this.form.controls.weekDays.updateValueAndValidity({ emitEvent: false });
    this.form.controls.dayOfMonth.updateValueAndValidity({ emitEvent: false });
    this.form.controls.intervalDays.updateValueAndValidity({ emitEvent: false });
  }

  load(): void {
    this.loading.set(true);
    this.eventService.findAllByCompanyId().subscribe({
      next: events => {
        this.events.set(events);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los eventos' });
      }
    });
  }

  get currentType(): RecurrenceType {
    return this.form.controls.recurrenceType.value;
  }

  newEvent(): void {
    this.editingId.set(null);
    this.selectedEventPeople = [];
    this.form.reset({
      name: '',
      description: '',
      recurrenceType: 'ONCE',
      weekDays: [],
      dayOfMonth: null,
      intervalDays: null,
      startTime: null,
      endTime: null,
      startDate: null,
      endDate: null,
      personSelectionMode: 'ALL',
      personGroupId: null
    });
    this.dialogVisible.set(true);
  }

  editEvent(event: Event): void {
    this.editingId.set(event.eventId ?? null);
    this.selectedEventPeople = [];
    this.form.reset({
      name: event.name,
      description: event.description ?? '',
      recurrenceType: event.recurrenceType,
      weekDays: event.weekDays ? event.weekDays.split(',') : [],
      dayOfMonth: event.dayOfMonth ?? null,
      intervalDays: event.intervalDays ?? null,
      startTime: event.startTime ? this.dateService.parseIsoTime(event.startTime) : null,
      endTime: event.endTime ? this.dateService.parseIsoTime(event.endTime) : null,
      startDate: event.startDate ? this.dateService.parseIsoDate(event.startDate) : null,
      endDate: event.endDate ? this.dateService.parseIsoDate(event.endDate) : null,
      personSelectionMode: event.personSelectionMode ?? 'ALL',
      personGroupId: event.personGroupId ?? null
    });
    this.dialogVisible.set(true);

    if (event.personSelectionMode === 'GROUP' || event.personSelectionMode === 'SPECIFIC') {
      this.eventService.findEventPeople(event.eventId!).subscribe(personIds => {
        this.selectedEventPeople = personIds;
      });
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();

    const request: Event = {
      name: v.name,
      description: v.description,
      recurrenceType: v.recurrenceType,
      weekDays: v.recurrenceType === 'WEEKLY' ? v.weekDays.join(',') : null,
      dayOfMonth: v.recurrenceType === 'MONTHLY' ? v.dayOfMonth : null,
      intervalDays: v.recurrenceType === 'EVERY_N_DAYS' ? v.intervalDays : null,
      startTime: this.dateService.toIsoTime(v.startTime!),
      endTime: this.dateService.toIsoTime(v.endTime!),
      startDate: this.dateService.toIsoDate(v.startDate!),
      endDate: v.endDate ? this.dateService.toIsoDate(v.endDate) : null,
      companyId: environment.companyId,
      personSelectionMode: v.personSelectionMode,
      personGroupId: v.personSelectionMode === 'GROUP' ? v.personGroupId : null
    };

    const id = this.editingId();
    const obs = id ? this.eventService.update(id, request) : this.eventService.save(request);
    const peopleToSave = v.personSelectionMode === 'ALL' ? [] : this.selectedEventPeople;

    obs.subscribe({
      next: saved => {
        this.eventService.setEventPeople(saved.eventId!, peopleToSave).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Evento guardado' });
            this.dialogVisible.set(false);
            this.load();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'El evento se guardó pero no se pudo guardar la lista de personas' });
            this.dialogVisible.set(false);
            this.load();
          }
        });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el evento' });
      }
    });
  }

  peopleExcludingGroup(): Person[] {
    const groupId = this.form.controls.personGroupId.value;
    if (this.currentPersonSelectionMode !== 'GROUP' || !groupId) return this.allPeople();
    return this.allPeople().filter(p => p.personGroupId !== groupId);
  }

  delete(event: Event): void {
    this.confirmationService.confirm({
      message: `¿Eliminar el evento "${event.name}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.eventService.delete(event.eventId!).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Evento eliminado' });
            this.load();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el evento' });
          }
        });
      }
    });
  }

  // --- Partes dinámicas ---

  openParts(event: Event): void {
    this.partsEvent.set(event);
    this.newPartName = '';
    this.partsDialogVisible.set(true);
    this.loadParts(event.eventId!);
  }

  loadParts(eventId: string): void {
    this.eventPartService.findAllByEventId(eventId).subscribe(parts => {
      this.parts.set(parts);
      this.editableTimes = Object.fromEntries(
        parts.map(p => [
          p.eventPartId!,
          { start: this.partTimeToDate(p.startTime), end: this.partTimeToDate(p.endTime) }
        ])
      );
      this.swapDaysState = Object.fromEntries(
        parts.map(p => [p.eventPartId!, p.swapWeekDays ? p.swapWeekDays.split(',') : []])
      );
    });
  }

  openEditPart(part: EventPart): void {
    this.editingPart.set(part);
    this.editPartNameValue = part.name;
    this.editPartDialogVisible.set(true);
  }

  saveEditPart(): void {
    const event = this.partsEvent();
    const part = this.editingPart();
    const newName = this.editPartNameValue.trim();
    if (!event || !part || !newName) return;

    this.eventPartService.update(part.eventPartId!, {
      eventId: event.eventId!,
      name: newName,
      sortOrder: part.sortOrder,
      startTime: part.startTime,
      endTime: part.endTime,
      linkGroupId: part.linkGroupId,
      swapWithPartId: part.swapWithPartId,
      swapWeekDays: part.swapWeekDays
    }).subscribe({
      next: updated => {
        this.applyUpdatedPart(updated);
        this.editPartDialogVisible.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo renombrar la parte' });
      }
    });
  }

  // --- Vínculo entre partes (misma persona repite en todas las partes del grupo) ---

  isSelectedForLink(part: EventPart): boolean {
    return this.selectedPartIds().has(part.eventPartId!);
  }

  clearLinkSelection(): void {
    this.selectedPartIds.set(new Set());
  }

  toggleSelectForLink(part: EventPart): void {
    this.selectedPartIds.update(current => {
      const next = new Set(current);
      if (next.has(part.eventPartId!)) {
        next.delete(part.eventPartId!);
      } else {
        next.add(part.eventPartId!);
      }
      return next;
    });
  }

  // Partes que comparten linkGroupId con `part` (sin incluirla a ella misma).
  linkedPartsFor(part: EventPart): EventPart[] {
    if (!part.linkGroupId) return [];
    return this.parts().filter(p => p.eventPartId !== part.eventPartId && p.linkGroupId === part.linkGroupId);
  }

  linkedPartNamesFor(part: EventPart): string {
    const names = this.linkedPartsFor(part).map(p => p.name);
    return names.length ? names.join(', ') : '—';
  }

  linkSelectedParts(): void {
    const event = this.partsEvent();
    const ids = this.selectedPartIds();
    if (!event || ids.size < 2) return;

    const groupId = crypto.randomUUID();
    const targets = this.parts().filter(p => ids.has(p.eventPartId!));
    const updates = targets.map(p =>
      this.eventPartService.update(p.eventPartId!, {
        eventId: event.eventId!,
        name: p.name,
        sortOrder: p.sortOrder,
        startTime: p.startTime,
        endTime: p.endTime,
        linkGroupId: groupId,
        swapWithPartId: p.swapWithPartId,
        swapWeekDays: p.swapWeekDays
      })
    );

    forkJoin(updates).subscribe({
      next: () => {
        this.selectedPartIds.set(new Set());
        this.loadParts(event.eventId!);
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Partes vinculadas: compartirán la misma persona en el sorteo' });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron vincular las partes' });
      }
    });
  }

  unlinkPart(part: EventPart): void {
    const event = this.partsEvent();
    if (!event) return;

    this.eventPartService.update(part.eventPartId!, {
      eventId: event.eventId!,
      name: part.name,
      sortOrder: part.sortOrder,
      startTime: part.startTime,
      endTime: part.endTime,
      linkGroupId: null,
      swapWithPartId: part.swapWithPartId,
      swapWeekDays: part.swapWeekDays
    }).subscribe({
      next: () => this.loadParts(event.eventId!),
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo desvincular la parte' });
      }
    });
  }

  // --- Intercambio de orden por día de la semana ---

  otherPartsFor(part: EventPart): EventPart[] {
    return this.parts().filter(p => p.eventPartId !== part.eventPartId);
  }

  swapWeekDaysFor(part: EventPart): string[] {
    return this.swapDaysState[part.eventPartId!] ?? [];
  }

  updateSwapTarget(part: EventPart, targetPartId: string | null): void {
    const event = this.partsEvent();
    if (!event) return;

    this.eventPartService.update(part.eventPartId!, {
      eventId: event.eventId!,
      name: part.name,
      sortOrder: part.sortOrder,
      startTime: part.startTime,
      endTime: part.endTime,
      linkGroupId: part.linkGroupId,
      swapWithPartId: targetPartId,
      swapWeekDays: targetPartId ? part.swapWeekDays : null
    }).subscribe({
      next: () => this.loadParts(event.eventId!),
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el intercambio de orden' });
      }
    });
  }

  updateSwapDays(part: EventPart, days: string[]): void {
    const event = this.partsEvent();
    if (!event) return;

    this.eventPartService.update(part.eventPartId!, {
      eventId: event.eventId!,
      name: part.name,
      sortOrder: part.sortOrder,
      startTime: part.startTime,
      endTime: part.endTime,
      linkGroupId: part.linkGroupId,
      swapWithPartId: part.swapWithPartId,
      swapWeekDays: days.length ? days.join(',') : null
    }).subscribe({
      next: () => this.loadParts(event.eventId!),
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar los días del intercambio' });
      }
    });
  }

  addPart(): void {
    const event = this.partsEvent();
    if (!event || !this.newPartName.trim()) return;

    const sortOrder = this.parts().length + 1;
    this.eventPartService.save({
      eventId: event.eventId!,
      name: this.newPartName.trim(),
      sortOrder
    }).subscribe({
      next: () => {
        this.newPartName = '';
        this.loadParts(event.eventId!);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo agregar la parte' });
      }
    });
  }

  dropPart(event: CdkDragDrop<EventPart[]>): void {
    const currentEvent = this.partsEvent();
    if (!currentEvent || event.previousIndex === event.currentIndex) return;

    const list = [...this.parts()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    const reordered = list.map((p, idx) => ({ ...p, sortOrder: idx + 1 }));
    this.parts.set(reordered);

    const updates = reordered.map(p =>
      this.eventPartService.update(p.eventPartId!, {
        eventId: currentEvent.eventId!,
        name: p.name,
        sortOrder: p.sortOrder,
        startTime: p.startTime,
        endTime: p.endTime,
        linkGroupId: p.linkGroupId,
        swapWithPartId: p.swapWithPartId,
        swapWeekDays: p.swapWeekDays
      })
    );

    forkJoin(updates).subscribe({
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el nuevo orden' });
        this.loadParts(currentEvent.eventId!);
      }
    });
  }

  partTimeToDate(time: string | null | undefined): Date | null {
    return time ? this.dateService.parseIsoTime(time) : null;
  }

  updatePartTime(part: EventPart, field: 'startTime' | 'endTime', date: Date | null): void {
    const event = this.partsEvent();
    if (!event) return;

    const request: EventPart = {
      eventId: event.eventId!,
      name: part.name,
      sortOrder: part.sortOrder,
      startTime: part.startTime,
      endTime: part.endTime,
      linkGroupId: part.linkGroupId,
      swapWithPartId: part.swapWithPartId,
      swapWeekDays: part.swapWeekDays,
      [field]: date ? this.dateService.toIsoTime(date) : null
    };

    this.eventPartService.update(part.eventPartId!, request).subscribe({
      next: updated => this.applyUpdatedPart(updated),
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el horario de la parte' });
      }
    });
  }

  clearPartTime(part: EventPart): void {
    const event = this.partsEvent();
    if (!event) return;

    this.eventPartService.update(part.eventPartId!, {
      eventId: event.eventId!,
      name: part.name,
      sortOrder: part.sortOrder,
      startTime: null,
      endTime: null,
      linkGroupId: part.linkGroupId,
      swapWithPartId: part.swapWithPartId,
      swapWeekDays: part.swapWeekDays
    }).subscribe({
      next: updated => this.applyUpdatedPart(updated),
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo limpiar el horario de la parte' });
      }
    });
  }

  // Solo actualiza en memoria la parte puntual que se guardó (sin recargar toda la lista),
  // para no pisar la edición de otro campo/fila que el usuario tenga en curso al mismo tiempo.
  private applyUpdatedPart(updated: EventPart): void {
    this.parts.update(list => list.map(p => (p.eventPartId === updated.eventPartId ? updated : p)));
    this.editableTimes = {
      ...this.editableTimes,
      [updated.eventPartId!]: {
        start: this.partTimeToDate(updated.startTime),
        end: this.partTimeToDate(updated.endTime)
      }
    };
  }

  deletePart(part: EventPart): void {
    this.eventPartService.delete(part.eventPartId!).subscribe({
      next: () => this.loadParts(part.eventId),
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar la parte' });
      }
    });
  }

  typeLabel(type: RecurrenceType): string {
    return this.recurrenceTypes.find(t => t.value === type)?.label ?? type;
  }
}
