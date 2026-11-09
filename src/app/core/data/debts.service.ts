import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL, localDateTime } from '../api/api';
import { Expense, ExpenseDraft } from '../models';

const norm = (e: Expense): Expense => ({
  ...e,
  reason: e.reason ?? '',
  debtor: e.debtor ?? '',
  date: localDateTime(e.date),
});

/** Тело запроса DebtDraft: ФИО должника, причина, сумма, дата-время, кто оформил. */
const body = (d: ExpenseDraft) => ({
  debtor: d.debtor,
  reason: d.reason,
  sum: d.sum,
  date: d.date,
  who: d.who,
});

/** Долги (REST API /debts). */
@Service()
export class DebtsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  list(): Observable<Expense[]> {
    return this.http.get<Expense[]>(`${this.api}/debts`).pipe(map((list) => list.map(norm)));
  }

  create(draft: ExpenseDraft): Observable<Expense> {
    return this.http.post<Expense>(`${this.api}/debts`, body(draft)).pipe(map(norm));
  }

  update(id: number, draft: ExpenseDraft): Observable<Expense> {
    return this.http.put<Expense>(`${this.api}/debts/${id}`, body(draft)).pipe(map(norm));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/debts/${id}`);
  }
}
