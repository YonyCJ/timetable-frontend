import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PersonGroup } from '../models/person-group.model';

@Injectable({ providedIn: 'root' })
export class PersonGroupService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/person-group`;

  findAllByCompanyId(companyId: string = environment.companyId): Observable<PersonGroup[]> {
    return this.http.get<PersonGroup[]>(`${this.baseUrl}/company/${companyId}`);
  }

  save(request: PersonGroup): Observable<PersonGroup> {
    return this.http.post<PersonGroup>(this.baseUrl, request);
  }

  update(id: string, request: PersonGroup): Observable<PersonGroup> {
    return this.http.put<PersonGroup>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
