import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL, localDateTime } from '../api/api';
import { Expense, ExpenseDraft } from '../models';

const norm = (e: Expense): Expense => ({ ...e, date: localDateTime(e.date) });

/** Тело запроса. С v1.1 сервер хранит дату расхода вместе со временем (с секундами). */
const body = (d: ExpenseDraft) => ({
  reason: d.reason,
  sum: d.sum,
  date: d.date,
  who: d.who,
});

/** Расходы (REST API /expenses). */
@Service()
export class ExpensesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  list(): Observable<Expense[]> {
    return this.http.get<Expense[]>(`${this.api}/expenses`).pipe(map((list) => list.map(norm)));
  }

  recent(limit: number): Observable<Expense[]> {
    return this.http
      .get<Expense[]>(`${this.api}/expenses/recent`, { params: { limit } })
      .pipe(map((list) => list.map(norm)));
  }

  create(draft: ExpenseDraft): Observable<Expense> {
    return this.http.post<Expense>(`${this.api}/expenses`, body(draft)).pipe(map(norm));
  }

  update(id: number, draft: ExpenseDraft): Observable<Expense> {
    return this.http.put<Expense>(`${this.api}/expenses/${id}`, body(draft)).pipe(map(norm));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/expenses/${id}`);
  }
}
