export interface EventPart {
  eventPartId?: string;
  eventId: string;
  name: string;
  sortOrder: number;
  // Optional manual schedule ("HH:mm:ss"). If both are null/undefined, it's computed automatically.
  startTime?: string | null;
  endTime?: string | null;
  // Partes con el mismo linkGroupId se sortean juntas: la misma persona hace todas. Null = sin vínculo.
  linkGroupId?: string | null;
  // En los días listados en swapWeekDays ("MONDAY,TUESDAY,...") esta parte intercambia su orden
  // efectivo con swapWithPartId (y viceversa). Null = sin intercambio.
  swapWithPartId?: string | null;
  swapWeekDays?: string | null;
  createdBy?: string;
  lastModifiedBy?: string;
}
