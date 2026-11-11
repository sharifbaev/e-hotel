import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { API_URL } from '../api/api';
import { ServiceTypeItem } from '../models';

/** Справочник видов дополнительных сервисов (REST API /service-types). */
@Service()
export class ServiceTypesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  list(): Observable<ServiceTypeItem[]> {
    return this.http.get<ServiceTypeItem[]>(`${this.api}/service-types`);
  }

  /** Для селектов: при ошибке — пустой список (остаётся только «Другое»). */
  options(): Observable<ServiceTypeItem[]> {
    return this.list().pipe(catchError(() => of([])));
  }

  save(name: string, id: number | null): Observable<ServiceTypeItem> {
    const body = { name: name.trim() };
    return id === null
      ? this.http.post<ServiceTypeItem>(`${this.api}/service-types`, body)
      : this.http.put<ServiceTypeItem>(`${this.api}/service-types/${id}`, body);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/service-types/${id}`);
  }
}
