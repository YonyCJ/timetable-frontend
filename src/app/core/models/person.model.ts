export interface Person {
  personId?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  companyId?: string;
  // Grupo/área al que pertenece (ej. "Coro", "Jóvenes"). Null/undefined = sin grupo.
  personGroupId?: string | null;
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface PersonUnavailability {
  personUnavailabilityId?: string;
  personId: string;
  dayOfWeek?: string | null; // DayOfWeek in English, e.g. "MONDAY"
  unavailableDate?: string | null; // "YYYY-MM-DD"; single date, or start of a range if untilDate is set
  untilDate?: string | null; // "YYYY-MM-DD"; end of the range (optional)
  reason?: string;
  createdBy?: string;
  lastModifiedBy?: string;
}
