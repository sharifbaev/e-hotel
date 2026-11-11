import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppSection } from '../models';
import { AuthService } from './auth.service';

/** Пускает только вошедших пользователей, иначе — на страницу входа. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() || inject(Router).createUrlTree(['/login']);
};

/** Страница входа доступна только гостям. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.isLoggedIn() || inject(Router).parseUrl(auth.homePath());
};

/** Разделы администрирования — только владелец и администратор. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() || inject(Router).createUrlTree(['/dashboard']);
};

/** Раздел меню доступен роли пользователя, иначе — на первый доступный раздел. */
export function sectionGuard(section: AppSection): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    return auth.can(section) || inject(Router).parseUrl(auth.homePath());
  };
}
