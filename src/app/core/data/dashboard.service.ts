import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL } from '../api/api';
import { DashboardSummary, IsoDate } from '../models';

const EMPTY_FUND: DashboardSummary['fund'] = { free: 0, busy: 0, clean: 0, repair: 0 };

/** Сводка для дашборда за период (REST API GET /dashboard?from=&to=). */
@Service()
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  summary(from: IsoDate, to: IsoDate): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.api}/dashboard`, { params: { from, to } }).pipe(
      map((s) => ({
        ...s,
        daily: s.daily ?? [],
        categories: s.categories ?? [],
        arrivals: s.arrivals ?? [],
        fund: { ...EMPTY_FUND, ...(s.fund as Partial<DashboardSummary['fund']> | null) },
      })),
    );
  }
}
