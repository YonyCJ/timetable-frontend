import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Person, PersonUnavailability } from '../models/person.model';

@Injectable({ providedIn: 'root' })
export class PersonService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/person`;
  private unavailabilityUrl = `${environment.apiUrl}/person-unavailability`;

  findAllByCompanyId(companyId: string = environment.companyId): Observable<Person[]> {
    return this.http.get<Person[]>(`${this.baseUrl}/company/${companyId}`);
  }

  findById(id: string): Observable<Person> {
    return this.http.get<Person>(`${this.baseUrl}/${id}`);
  }

  save(request: Person): Observable<Person> {
    return this.http.post<Person>(this.baseUrl, request);
  }

  update(id: string, request: Person): Observable<Person> {
    return this.http.put<Person>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  findUnavailabilityByPersonId(personId: string): Observable<PersonUnavailability[]> {
    return this.http.get<PersonUnavailability[]>(`${this.unavailabilityUrl}/person/${personId}`);
  }

  saveUnavailability(request: PersonUnavailability): Observable<PersonUnavailability> {
    return this.http.post<PersonUnavailability>(this.unavailabilityUrl, request);
  }

  deleteUnavailability(id: string): Observable<void> {
    return this.http.delete<void>(`${this.unavailabilityUrl}/${id}`);
  }
}
