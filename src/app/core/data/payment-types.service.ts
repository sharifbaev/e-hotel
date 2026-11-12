import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, catchError, of, tap } from 'rxjs';
import { API_URL } from '../api/api';
import { PaymentTypeItem, SYSTEM_PAYMENTS } from '../models';

/** Пока справочник не загружен (или сервер недоступен) — системные типы. */
const FALLBACK: PaymentTypeItem[] = SYSTEM_PAYMENTS.map((code, i) => ({
  id: -(i + 1),
  code,
  name: '',
  system: true,
}));

/** Справочник «Тип оплаты» (REST API /payment-types). */
@Service()
export class PaymentTypesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly transloco = inject(TranslocoService);

  /** Текущий список для селектов, фильтров и подписей. */
  readonly items = signal<PaymentTypeItem[]>(FALLBACK);
  private loaded = false;

  list(): Observable<PaymentTypeItem[]> {
    return this.http
      .get<PaymentTypeItem[]>(`${this.api}/payment-types`)
      .pipe(tap((list) => this.items.set(list)));
  }

  /** Загрузить один раз за сессию (для форм и таблиц). */
  ensureLoaded(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    this.list()
      .pipe(catchError(() => ((this.loaded = false), of(null))))
      .subscribe();
  }

  /** Подпись типа по коду: системные — перевод, свои — название из справочника. */
  label(code: string | null | undefined): string {
    if (!code) {
      return '';
    }
    const item = this.items().find((t) => t.code === code);
    if (!item || item.system || (SYSTEM_PAYMENTS as readonly string[]).includes(code)) {
      const key = `paymentMethods.${code}`;
      const t = this.transloco.translate(key);
      return t === key ? (item?.name || code) : t;
    }
    return item.name;
  }

  save(name: string, id: number | null): Observable<PaymentTypeItem> {
    const body = { name: name.trim() };
    const req =
      id === null
        ? this.http.post<PaymentTypeItem>(`${this.api}/payment-types`, body)
        : this.http.put<PaymentTypeItem>(`${this.api}/payment-types/${id}`, body);
    return req.pipe(
      tap((saved) =>
        this.items.update((l) =>
          id === null ? [...l, saved] : l.map((t) => (t.id === id ? saved : t)),
        ),
      ),
    );
  }

  remove(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.api}/payment-types/${id}`)
      .pipe(tap(() => this.items.update((l) => l.filter((t) => t.id !== id))));
  }
}
