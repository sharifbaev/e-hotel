import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth/auth.guards';

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
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
      },
      {
        path: 'rooms',
        loadComponent: () => import('./features/rooms/rooms').then((m) => m.RoomsPage),
      },
      {
        path: 'book',
        loadComponent: () => import('./features/book/book').then((m) => m.BookPage),
      },
      {
        path: 'blacklist',
        loadComponent: () => import('./features/blacklist/blacklist').then((m) => m.BlacklistPage),
      },
      {
        path: 'guests',
        loadComponent: () => import('./features/guests/guests').then((m) => m.GuestsPage),
      },
      {
        // «Платежи и расходы»: вкладки Расходы / Дополнительные сервисы / Долги (?tab=…)
        path: 'payments',
        loadComponent: () => import('./features/payments/payments').then((m) => m.PaymentsPage),
      },
      // Старый адрес «Расходов» ведёт на первую вкладку «Платежей и расходов»
      { path: 'expenses', pathMatch: 'full', redirectTo: 'payments' },
      {
        path: 'comments',
        loadComponent: () => import('./features/comments/comments').then((m) => m.CommentsPage),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/users/users').then((m) => m.UsersPage),
      },
      {
        path: 'settings',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage),
      },
      {
        path: 'more',
        loadComponent: () => import('./features/more/more').then((m) => m.MorePage),
      },
      {
        path: 'ui-kit',
        loadComponent: () => import('./features/ui-kit/ui-kit').then((m) => m.UiKitPage),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
