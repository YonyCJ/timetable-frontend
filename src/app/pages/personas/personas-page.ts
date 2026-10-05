import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToolbarModule } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { MessageService, ConfirmationService } from 'primeng/api';

import { PersonService } from '../../core/services/person.service';
import { PersonGroupService } from '../../core/services/person-group.service';
import { DateService } from '../../core/services/date.service';
import { Person, PersonUnavailability } from '../../core/models/person.model';
import { PersonGroup } from '../../core/models/person-group.model';
import { WEEK_DAYS } from '../../core/models/event.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-personas-page',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    TableModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    ToastModule,
    ConfirmDialogModule,
    ToolbarModule,
    TooltipModule,
    TagModule
  ],
  templateUrl: './personas-page.html'
})
export class PersonasPage implements OnInit {
  private personService = inject(PersonService);
  private personGroupService = inject(PersonGroupService);
  private dateService = inject(DateService);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  people = signal<Person[]>([]);
  loading = signal(false);
  groups = signal<PersonGroup[]>([]);

  dialogVisible = signal(false);
  editingId = signal<string | null>(null);

  groupsDialogVisible = signal(false);
  newGroupName = '';

  unavailabilityDialogVisible = signal(false);
  unavailabilityPerson = signal<Person | null>(null);
  restrictions = signal<PersonUnavailability[]>([]);
  weekDayOptions = WEEK_DAYS;
  newRestrictionType: 'WEEKDAY' | 'DATE' | 'DATE_RANGE' = 'WEEKDAY';
  newRestrictionDay: string | null = null;
  newRestrictionDate: Date | null = null;
  newRestrictionDateFrom: Date | null = null;
  newRestrictionDateTo: Date | null = null;
  newRestrictionReason = '';

  form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: [''],
    phone: [''],
    email: [''],
    personGroupId: [null as string | null]
  });

  ngOnInit(): void {
    this.load();
    this.loadGroups();
  }

  loadGroups(): void {
    this.personGroupService.findAllByCompanyId().subscribe(groups => this.groups.set(groups));
  }

  groupNameFor(person: Person): string | null {
    return this.groups().find(g => g.personGroupId === person.personGroupId)?.name ?? null;
  }

  // --- Grupos/áreas ---

  openGroups(): void {
    this.newGroupName = '';
    this.groupsDialogVisible.set(true);
  }

  addGroup(): void {
    if (!this.newGroupName.trim()) return;
    this.personGroupService.save({ name: this.newGroupName.trim(), companyId: environment.companyId }).subscribe({
      next: () => {
        this.newGroupName = '';
        this.loadGroups();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear el grupo' });
      }
    });
  }

  renameGroup(group: PersonGroup, name: string): void {
    const trimmed = name.trim();
    if (!trimmed || trimmed === group.name) return;
    this.personGroupService.update(group.personGroupId!, { name: trimmed, companyId: environment.companyId }).subscribe({
      next: () => this.loadGroups(),
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo renombrar el grupo' });
      }
    });
  }

  deleteGroup(group: PersonGroup): void {
    this.confirmationService.confirm({
      message: `¿Eliminar el grupo "${group.name}"? Las personas que pertenecen a él quedarán sin grupo.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.personGroupService.delete(group.personGroupId!).subscribe({
          next: () => {
            this.loadGroups();
            this.load();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el grupo' });
          }
        });
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.personService.findAllByCompanyId().subscribe({
      next: people => {
        this.people.set(people);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las personas' });
      }
    });
  }

  newPerson(): void {
    this.editingId.set(null);
    this.form.reset({ firstName: '', lastName: '', phone: '', email: '', personGroupId: null });
    this.dialogVisible.set(true);
  }

  editPerson(person: Person): void {
    this.editingId.set(person.personId ?? null);
    this.form.reset({
      firstName: person.firstName,
      lastName: person.lastName,
      phone: person.phone ?? '',
      email: person.email ?? '',
      personGroupId: person.personGroupId ?? null
    });
    this.dialogVisible.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const request: Person = { ...this.form.getRawValue(), companyId: environment.companyId };
    const id = this.editingId();
    const obs = id ? this.personService.update(id, request) : this.personService.save(request);

    obs.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Persona guardada' });
        this.dialogVisible.set(false);
        this.load();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la persona' });
      }
    });
  }

  delete(person: Person): void {
    this.confirmationService.confirm({
      message: `¿Eliminar a "${person.firstName} ${person.lastName}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.personService.delete(person.personId!).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Persona eliminada' });
            this.load();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar la persona' });
          }
        });
      }
    });
  }

  // --- Disponibilidad ---

  openUnavailability(person: Person): void {
    this.unavailabilityPerson.set(person);
    this.newRestrictionType = 'WEEKDAY';
    this.newRestrictionDay = null;
    this.newRestrictionDate = null;
    this.newRestrictionDateFrom = null;
    this.newRestrictionDateTo = null;
    this.newRestrictionReason = '';
    this.unavailabilityDialogVisible.set(true);
    this.loadRestrictions(person.personId!);
  }

  loadRestrictions(personId: string): void {
    this.personService.findUnavailabilityByPersonId(personId).subscribe(r => this.restrictions.set(r));
  }

  addRestriction(): void {
    const person = this.unavailabilityPerson();
    if (!person) return;

    if (this.newRestrictionType === 'WEEKDAY' && !this.newRestrictionDay) return;
    if (this.newRestrictionType === 'DATE' && !this.newRestrictionDate) return;
    if (this.newRestrictionType === 'DATE_RANGE' && (!this.newRestrictionDateFrom || !this.newRestrictionDateTo)) return;

    const request: PersonUnavailability = {
      personId: person.personId!,
      dayOfWeek: this.newRestrictionType === 'WEEKDAY' ? this.newRestrictionDay : null,
      unavailableDate: this.newRestrictionType === 'DATE' ? this.dateService.toIsoDate(this.newRestrictionDate!)
                      : this.newRestrictionType === 'DATE_RANGE' ? this.dateService.toIsoDate(this.newRestrictionDateFrom!)
                      : null,
      untilDate: this.newRestrictionType === 'DATE_RANGE' ? this.dateService.toIsoDate(this.newRestrictionDateTo!) : null,
      reason: this.newRestrictionReason
    };

    this.personService.saveUnavailability(request).subscribe({
      next: () => {
        this.newRestrictionDay = null;
        this.newRestrictionDate = null;
        this.newRestrictionDateFrom = null;
        this.newRestrictionDateTo = null;
        this.newRestrictionReason = '';
        this.loadRestrictions(person.personId!);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo agregar la restricción' });
      }
    });
  }

  deleteRestriction(restriction: PersonUnavailability): void {
    this.personService.deleteUnavailability(restriction.personUnavailabilityId!).subscribe({
      next: () => this.loadRestrictions(restriction.personId),
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar la restricción' });
      }
    });
  }

  dayLabel(day: string | null | undefined): string {
    return this.weekDayOptions.find(d => d.value === day)?.label ?? '';
  }

}
