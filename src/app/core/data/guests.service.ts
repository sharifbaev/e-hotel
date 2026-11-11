import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL, localDateTime, normDocDates } from '../api/api';
import { ArchivedGuest, GuestProfile, GuestRegistration } from '../models';
import { BookService } from './book.service';

/**
 * Гости: архив выехавших и поиск профиля по документу (REST API /guests).
 * В архив гости попадают на сервере при выселении (POST /rooms/:n/checkout).
 */
@Service()
export class GuestsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly book = inject(BookService);

  archive(): Observable<ArchivedGuest[]> {
    return this.http.get<ArchivedGuest[]>(`${this.api}/guests/archive`).pipe(
      map((list) =>
        list.map((g) => ({
          ...normDocDates(g),
          checkin: localDateTime(g.checkin),
          checkout: localDateTime(g.checkout),
          receipt: g.receipt ?? null,
        })),
      ),
    );
  }

  /** Поиск гостя по серии и номеру документа (лупа в форме регистрации). 404 — guests.notFound. */
  lookupByDoc(doc: string): Observable<GuestProfile> {
    return this.http.get<GuestProfile>(`${this.api}/guests/lookup`, {
      params: { doc: doc.trim() },
    }).pipe(map(normDocDates));
  }

  /** Регистрация одного гостя (форма без вкладок) — то же, что POST /book с одной записью. */
  register(data: GuestRegistration): Observable<{ room: string; name: string }> {
    return this.book
      .register([data])
      .pipe(map(() => ({ room: data.room, name: `${data.lastName} ${data.firstName}`.trim() })));
  }
}
