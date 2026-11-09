import { IconName } from '../shared/ui/icon/icon';

export interface NavItem {
  path: string;
  /** Ключ i18n подписи. */
  label: string;
  icon: IconName;
  adminOnly?: boolean;
  /** Показывать счётчик новых комментариев. */
  commentsBadge?: boolean;
}

/** Основное меню (сайдбар на десктопе). */
export const MAIN_NAV: NavItem[] = [
  { path: '/dashboard', label: 'nav.dashboard', icon: 'dashboard' },
  { path: '/rooms', label: 'nav.rooms', icon: 'bed' },
  { path: '/book', label: 'nav.book', icon: 'book' },
  { path: '/guests', label: 'nav.guests', icon: 'users' },
  { path: '/blacklist', label: 'nav.blacklist', icon: 'ban' },
  { path: '/payments', label: 'nav.payments', icon: 'wallet' },
  { path: '/comments', label: 'nav.comments', icon: 'message', commentsBadge: true },
];

export const ADMIN_NAV: NavItem[] = [
  { path: '/users', label: 'nav.users', icon: 'shield', adminOnly: true },
  { path: '/settings', label: 'nav.settings', icon: 'settings', adminOnly: true },
];

/** Нижнее меню мобильной версии. */
export const MOBILE_NAV: NavItem[] = [
  { path: '/dashboard', label: 'nav.home', icon: 'dashboard' },
  { path: '/rooms', label: 'nav.rooms', icon: 'bed' },
  { path: '/book', label: 'nav.book', icon: 'book' },
  { path: '/payments', label: 'nav.paymentsShort', icon: 'wallet' },
  { path: '/more', label: 'nav.more', icon: 'more' },
];
