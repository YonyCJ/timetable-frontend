import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EventPart } from '../models/event-part.model';

@Injectable({ providedIn: 'root' })
export class EventPartService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/event-part`;

  findAllByEventId(eventId: string): Observable<EventPart[]> {
    return this.http.get<EventPart[]>(`${this.baseUrl}/event/${eventId}`);
  }

  save(request: EventPart): Observable<EventPart> {
    return this.http.post<EventPart>(this.baseUrl, request);
  }

  update(id: string, request: EventPart): Observable<EventPart> {
    return this.http.put<EventPart>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
