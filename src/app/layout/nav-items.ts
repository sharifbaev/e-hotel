import { AppSection } from '../core/models';
import { IconName } from '../shared/ui/icon/icon';

export interface NavItem {
  path: string;
  /** Ключ i18n подписи. */
  label: string;
  icon: IconName;
  /** Раздел для проверки доступа роли; нет — пункт виден всем. */
  section?: AppSection;
  /** Показывать счётчик новых комментариев. */
  commentsBadge?: boolean;
  /** Только владелец (журнал действий). */
  ownerOnly?: boolean;
}

/** Основное меню (сайдбар на десктопе). */
export const MAIN_NAV: NavItem[] = [
  { path: '/dashboard', label: 'nav.dashboard', icon: 'dashboard', section: 'dashboard' },
  { path: '/rooms', label: 'nav.rooms', icon: 'bed', section: 'rooms' },
  { path: '/book', label: 'nav.book', icon: 'book', section: 'book' },
  { path: '/guests', label: 'nav.guests', icon: 'users', section: 'guests' },
  { path: '/blacklist', label: 'nav.blacklist', icon: 'ban', section: 'blacklist' },
  { path: '/payments', label: 'nav.payments', icon: 'wallet', section: 'payments' },
  {
    path: '/comments',
    label: 'nav.comments',
    icon: 'message',
    section: 'comments',
    commentsBadge: true,
  },
];

export const ADMIN_NAV: NavItem[] = [
  { path: '/users', label: 'nav.users', icon: 'shield', section: 'users' },
  { path: '/references', label: 'nav.references', icon: 'list-search', section: 'settings' },
  {
    path: '/audit-log',
    label: 'nav.auditLog',
    icon: 'clock',
    section: 'settings',
    ownerOnly: true,
  },
  { path: '/settings', label: 'nav.settings', icon: 'settings', section: 'settings' },
];

/** Нижнее меню мобильной версии. */
export const MOBILE_NAV: NavItem[] = [
  { path: '/dashboard', label: 'nav.home', icon: 'dashboard', section: 'dashboard' },
  { path: '/rooms', label: 'nav.rooms', icon: 'bed', section: 'rooms' },
  { path: '/book', label: 'nav.book', icon: 'book', section: 'book' },
  { path: '/payments', label: 'nav.paymentsShort', icon: 'wallet', section: 'payments' },
  { path: '/more', label: 'nav.more', icon: 'more' },
];
