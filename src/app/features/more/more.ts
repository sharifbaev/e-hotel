import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../core/auth/auth.service';
import { AppSection } from '../../core/models';
import { RoleLabelPipe } from '../../shared/ui/status/role-label.pipe';
import { CommentsService } from '../../core/data/comments.service';
import { initials } from '../../shared/format/format';
import { Icon, IconName } from '../../shared/ui/icon/icon';
import { LangSwitch } from '../../shared/ui/lang-switch/lang-switch';
import { Sheet } from '../../shared/ui/sheet/sheet';

interface MoreLink {
  path: string;
  label: string;
  hint: string;
  icon: IconName;
  bg: string;
  fg: string;
  /** Раздел для проверки доступа роли. */
  section: AppSection;
  /** Показывать счётчик новых комментариев. */
  commentsBadge?: boolean;
}

const LINKS: MoreLink[] = [
  {
    path: '/guests',
    section: 'guests',
    label: 'nav.guests',
    hint: 'more.guestsHint',
    icon: 'users',
    bg: '#DCE7FD',
    fg: '#1E3A8A',
  },
  {
    path: '/blacklist',
    section: 'blacklist',
    label: 'nav.blacklist',
    hint: 'more.blacklistHint',
    icon: 'ban',
    bg: '#FEE4E2',
    fg: '#B42318',
  },
  {
    path: '/comments',
    section: 'comments',
    label: 'nav.comments',
    hint: 'more.commentsHint',
    icon: 'message',
    bg: '#FEF0C7',
    fg: '#93370D',
    commentsBadge: true,
  },
  {
    path: '/users',
    label: 'nav.users',
    hint: 'more.usersHint',
    icon: 'shield',
    bg: '#EDE9FE',
    fg: '#5B21B6',
    section: 'users',
  },
  {
    path: '/settings',
    label: 'nav.settings',
    hint: 'more.settingsHint',
    icon: 'settings',
    bg: '#F2F4F7',
    fg: '#344054',
    section: 'settings',
  },
  {
    path: '/ui-kit',
    section: 'settings',
    label: 'nav.uikit',
    hint: 'more.uikitHint',
    icon: 'dashboard',
    bg: '#E6F4F2',
    fg: '#0B5A54',
  },
];

/** «Ещё» — мобильный раздел: профиль, остальные разделы, язык, выход. */
@Component({
  selector: 'app-more',
  imports: [RouterLink, TranslocoPipe, ButtonModule, Icon, LangSwitch, Sheet, RoleLabelPipe],
  template: `
    <header class="shrink-0 border-b border-line-2 bg-white px-4 pt-3.5 pb-3">
      <h1 class="m-0 text-xl font-bold">{{ 'nav.more' | transloco }}</h1>
    </header>
    <div
      class="no-scrollbar mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-4 overflow-y-auto p-4"
    >
      <div class="flex items-center gap-3 rounded-2xl border border-line-2 bg-white p-3.5">
        <span
          class="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-base font-bold text-white"
          aria-hidden="true"
        >
          {{ userInitials() }}
        </span>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="truncate text-base font-semibold">{{ auth.user()?.name }}</span>
          <span class="text-[13px] text-muted"
            >{{ auth.user()?.role | roleLabel: auth.user()?.roleName }} ·
              {{ auth.user()?.hotelName }}</span
          >
        </div>
      </div>

      <nav
        [attr.aria-label]="'more.sections' | transloco"
        class="overflow-hidden rounded-2xl border border-line-2 bg-white"
      >
        @for (l of links(); track l.path; let last = $last) {
          <a [routerLink]="l.path" class="more-row" [class.border-b]="!last">
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
              [style.background]="l.bg"
              [style.color]="l.fg"
            >
              <app-icon [name]="l.icon" [size]="20" [stroke]="1.8" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="text-[15px] font-semibold">{{ l.label | transloco }}</span>
              <span class="text-xs text-muted">{{ l.hint | transloco }}</span>
            </span>
            @if (l.commentsBadge && comments.newCount() > 0) {
              <span
                class="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-danger-strong px-[7px] text-xs font-bold text-white"
                >{{ comments.newCount() }}</span
              >
            }
            <app-icon name="chevron-right" class="text-faint" />
          </a>
        }
      </nav>

      <section class="flex flex-col gap-2.5 rounded-2xl border border-line-2 bg-white p-3.5">
        <span class="text-[13px] font-semibold text-ink-2">{{
          'common.language' | transloco
        }}</span>
        <app-lang-switch variant="segmented" />
      </section>

      <button
        type="button"
        class="tap flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-[#FECDCA] bg-white text-[15px] font-semibold text-danger"
        (click)="logoutOpen.set(true)"
      >
        <app-icon name="logout" />
        {{ 'more.logout' | transloco }}
      </button>
      <p class="m-0 text-center text-xs text-muted">
        {{ 'more.version' | transloco: { version: '1.0' } }}
      </p>
    </div>

    <app-sheet [(visible)]="logoutOpen" [title]="'more.logoutTitle' | transloco">
      <p class="mt-0 mb-2 text-sm leading-normal text-muted">{{ 'more.logoutText' | transloco }}</p>
      <div sheetFooter class="flex flex-col gap-2">
        <button pButton type="button" severity="danger" class="h-12" (click)="logout()">
          <span pButtonLabel>{{ 'shell.logout' | transloco }}</span>
        </button>
        <button
          pButton
          type="button"
          severity="secondary"
          [outlined]="true"
          class="h-12"
          (click)="logoutOpen.set(false)"
        >
          <span pButtonLabel>{{ 'common.cancel' | transloco }}</span>
        </button>
      </div>
    </app-sheet>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      flex: 1;
    }
    .more-row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 60px;
      padding: 0 14px;
      border-color: #f2f4f7;
      text-decoration: none;
      color: #101828;
      transition: background-color 0.15s;
    }
    .more-row:hover {
      background: #f9fafb;
      color: #101828;
    }
  `,
})
export class MorePage {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly comments = inject(CommentsService);
  protected readonly logoutOpen = signal(false);
  protected readonly links = computed(() =>
    LINKS.filter((l) => this.auth.can(l.section)),
  );
  protected readonly userInitials = computed(() => initials(this.auth.user()?.name ?? ''));

  protected logout(): void {
    this.logoutOpen.set(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
