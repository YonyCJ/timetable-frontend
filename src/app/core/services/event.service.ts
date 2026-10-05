import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Event } from '../models/event.model';

@Injectable({ providedIn: 'root' })
export class EventService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/event`;

  findAllByCompanyId(companyId: string = environment.companyId): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.baseUrl}/company/${companyId}`);
  }

  findById(id: string): Observable<Event> {
    return this.http.get<Event>(`${this.baseUrl}/${id}`);
  }

  save(request: Event): Observable<Event> {
    return this.http.post<Event>(this.baseUrl, request);
  }

  update(id: string, request: Event): Observable<Event> {
    return this.http.put<Event>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // Personas específicas/invitadas del evento (ver PersonSelectionMode).
  findEventPeople(eventId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/${eventId}/people`);
  }

  setEventPeople(eventId: string, personIds: string[]): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${eventId}/people`, personIds);
  }
}
