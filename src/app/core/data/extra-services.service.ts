import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL, localDateTime } from '../api/api';
import { Expense, ExpenseDraft } from '../models';

const norm = (e: Expense): Expense => ({
  ...e,
  reason: e.reason ?? '',
  date: localDateTime(e.date),
});

/** Тело запроса ExtraServiceDraft: вид услуги, причина (для 'other'), сумма, дата-время, кто оформил. */
const body = (d: ExpenseDraft) => ({
  serviceType: d.serviceType,
  reason: d.reason,
  sum: d.sum,
  date: d.date,
  who: d.who,
});

/** Дополнительные сервисы (REST API /extra-services). */
@Service()
export class ExtraServicesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  list(): Observable<Expense[]> {
    return this.http
      .get<Expense[]>(`${this.api}/extra-services`)
      .pipe(map((list) => list.map(norm)));
  }

  create(draft: ExpenseDraft): Observable<Expense> {
    return this.http.post<Expense>(`${this.api}/extra-services`, body(draft)).pipe(map(norm));
  }

  update(id: number, draft: ExpenseDraft): Observable<Expense> {
    return this.http
      .put<Expense>(`${this.api}/extra-services/${id}`, body(draft))
      .pipe(map(norm));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/extra-services/${id}`);
  }
}
