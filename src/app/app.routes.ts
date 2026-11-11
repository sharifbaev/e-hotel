import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { authGuard, guestGuard, sectionGuard } from './core/auth/auth.guards';
import { AuthService } from './core/auth/auth.service';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.LoginPage),
    title: 'HotelOS',
  },
  {
    // Публичная страница по QR-коду из номера: гость оставляет комментарий без входа.
    path: 'c/:room',
    loadComponent: () => import('./features/feedback/feedback').then((m) => m.FeedbackPage),
    title: 'HotelOS',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      // Стартовая страница — первый раздел, доступный роли.
      { path: '', pathMatch: 'full', redirectTo: () => inject(AuthService).homePath() },
      {
        path: 'dashboard',
        canActivate: [sectionGuard('dashboard')],
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
      },
      {
        path: 'rooms',
        canActivate: [sectionGuard('rooms')],
        loadComponent: () => import('./features/rooms/rooms').then((m) => m.RoomsPage),
      },
      {
        path: 'book',
        canActivate: [sectionGuard('book')],
        loadComponent: () => import('./features/book/book').then((m) => m.BookPage),
      },
      {
        path: 'blacklist',
        canActivate: [sectionGuard('blacklist')],
        loadComponent: () => import('./features/blacklist/blacklist').then((m) => m.BlacklistPage),
      },
      {
        path: 'guests',
        canActivate: [sectionGuard('guests')],
        loadComponent: () => import('./features/guests/guests').then((m) => m.GuestsPage),
      },
      {
        // «Платежи и расходы»: вкладки Расходы / Дополнительные сервисы / Долги (?tab=…)
        path: 'payments',
        canActivate: [sectionGuard('payments')],
        loadComponent: () => import('./features/payments/payments').then((m) => m.PaymentsPage),
      },
      // Старый адрес «Расходов» ведёт на первую вкладку «Платежей и расходов»
      { path: 'expenses', pathMatch: 'full', redirectTo: 'payments' },
      {
        path: 'comments',
        canActivate: [sectionGuard('comments')],
        loadComponent: () => import('./features/comments/comments').then((m) => m.CommentsPage),
      },
      {
        path: 'users',
        canActivate: [sectionGuard('users')],
        loadComponent: () => import('./features/users/users').then((m) => m.UsersPage),
      },
      {
        path: 'settings',
        canActivate: [sectionGuard('settings')],
        loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage),
      },
      {
        path: 'more',
        loadComponent: () => import('./features/more/more').then((m) => m.MorePage),
      },
      {
        path: 'ui-kit',
        canActivate: [sectionGuard('settings')],
        loadComponent: () => import('./features/ui-kit/ui-kit').then((m) => m.UiKitPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
