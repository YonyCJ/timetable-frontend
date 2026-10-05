export type RecurrenceType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'EVERY_N_DAYS';

export type PersonSelectionMode = 'ALL' | 'GROUP' | 'SPECIFIC';

export const PERSON_SELECTION_MODES: { value: PersonSelectionMode; label: string }[] = [
  { value: 'ALL', label: 'Todas las personas' },
  { value: 'GROUP', label: 'Un grupo específico' },
  { value: 'SPECIFIC', label: 'Personas específicas' }
];

export interface Event {
  eventId?: string;
  name: string;
  description?: string;
  recurrenceType: RecurrenceType;
  weekDays?: string | null; // "MONDAY,TUESDAY,..." (required if WEEKLY)
  dayOfMonth?: number | null; // required if MONTHLY
  intervalDays?: number | null; // required if EVERY_N_DAYS
  startTime: string; // "HH:mm:ss"
  endTime: string; // "HH:mm:ss"
  startDate: string; // "YYYY-MM-DD"
  endDate?: string | null;
  companyId?: string;
  // Quiénes son candidatos al sorteo: ALL = cualquier persona, GROUP = solo personGroupId
  // (+ invitados puntuales), SPECIFIC = únicamente la lista de invitados/específicas.
  personSelectionMode?: PersonSelectionMode | null;
  personGroupId?: string | null;
  createdBy?: string;
  lastModifiedBy?: string;
}

export const WEEK_DAYS: { value: string; label: string }[] = [
  { value: 'MONDAY', label: 'Lunes' },
  { value: 'TUESDAY', label: 'Martes' },
  { value: 'WEDNESDAY', label: 'Miércoles' },
  { value: 'THURSDAY', label: 'Jueves' },
  { value: 'FRIDAY', label: 'Viernes' },
  { value: 'SATURDAY', label: 'Sábado' },
  { value: 'SUNDAY', label: 'Domingo' }
];

export const RECURRENCE_TYPES: { value: RecurrenceType; label: string }[] = [
  { value: 'ONCE', label: 'Único' },
  { value: 'DAILY', label: 'Diario' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'EVERY_N_DAYS', label: 'Interdiario' }
];
