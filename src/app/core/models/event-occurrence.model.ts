export interface EventOccurrence {
  eventOccurrenceId: string;
  eventId: string;
  occurrenceDate: string; // "YYYY-MM-DD"
  cancelled: boolean;
  cancellationReason?: string | null;
}

export type AssignmentOrigin = 'MANUAL' | 'AUTOMATIC';

export interface Assignment {
  assignmentId?: string;
  eventOccurrenceId: string;
  eventPartId: string;
  personId: string;
  origin: AssignmentOrigin;
}
