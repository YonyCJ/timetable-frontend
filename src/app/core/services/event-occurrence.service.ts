import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Assignment, EventOccurrence } from '../models/event-occurrence.model';

@Injectable({ providedIn: 'root' })
export class EventOccurrenceService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/event-occurrence`;
  private assignmentUrl = `${environment.apiUrl}/assignment`;

  findAllByEventId(eventId: string, from?: string, to?: string): Observable<EventOccurrence[]> {
    let params = '';
    if (from && to) {
      params = `?from=${from}&to=${to}`;
    }
    return this.http.get<EventOccurrence[]>(`${this.baseUrl}/event/${eventId}${params}`);
  }

  generate(eventId: string, from: string, to: string): Observable<EventOccurrence[]> {
    return this.http.post<EventOccurrence[]>(`${this.baseUrl}/generate`, { eventId, from, to });
  }

  cancel(eventOccurrenceId: string, cancellationReason: string, lastModifiedBy?: string): Observable<EventOccurrence> {
    return this.http.put<EventOccurrence>(`${this.baseUrl}/${eventOccurrenceId}/cancel`, {
      cancellationReason,
      lastModifiedBy
    });
  }

  reactivate(eventOccurrenceId: string, lastModifiedBy?: string): Observable<EventOccurrence> {
    const params = lastModifiedBy ? `?lastModifiedBy=${lastModifiedBy}` : '';
    return this.http.put<EventOccurrence>(`${this.baseUrl}/${eventOccurrenceId}/reactivate${params}`, {});
  }

  findAssignmentsByEventOccurrenceId(eventOccurrenceId: string): Observable<Assignment[]> {
    return this.http.get<Assignment[]>(`${this.assignmentUrl}/occurrence/${eventOccurrenceId}`);
  }

  assignManually(request: {
    eventOccurrenceId: string;
    eventPartId: string;
    personId: string;
    createdBy?: string;
    lastModifiedBy?: string;
  }): Observable<Assignment> {
    return this.http.post<Assignment>(`${this.assignmentUrl}/manual`, request);
  }

  draw(eventOccurrenceId: string, companyId: string = environment.companyId, createdBy?: string): Observable<Assignment[]> {
    return this.http.post<Assignment[]>(`${this.assignmentUrl}/draw`, {
      eventOccurrenceId,
      companyId,
      createdBy
    });
  }

  deleteAssignment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.assignmentUrl}/${id}`);
  }
}
