import { BreakpointObserver } from '@angular/cdk/layout';
import { Service, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Ширина, ниже которой включается мобильная версия (нижнее меню, карточки вместо таблиц). */
export const MOBILE_QUERY = '(max-width: 767.98px)';

@Service()
export class BreakpointService {
  private readonly observer = inject(BreakpointObserver);

  readonly isMobile = toSignal(this.observer.observe(MOBILE_QUERY).pipe(map((s) => s.matches)), {
    initialValue: this.observer.isMatched(MOBILE_QUERY),
  });
}
