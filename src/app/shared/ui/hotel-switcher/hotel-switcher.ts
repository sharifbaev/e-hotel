import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Popover } from 'primeng/popover';
import { AuthService } from '../../../core/auth/auth.service';
import { HotelItem } from '../../../core/models';
import { Icon } from '../icon/icon';

/**
 * Переключатель отелей (v1.6). Виден, только если у пользователя больше одного отеля.
 * variant="header" — кнопка с названием отеля и выпадающим списком (шапка десктопа);
 * variant="block" — карточка для страницы «Ещё» (телефон).
 */
@Component({
  selector: 'app-hotel-switcher',
  imports: [TranslocoPipe, Popover, Icon],
  template: `
    @if (auth.multiHotel()) {
      @if (variant() === 'header') {
        <button
          type="button"
          class="switch-btn"
          aria-haspopup="listbox"
          [attr.aria-label]="'hotels.switch' | transloco"
          (click)="list.toggle($event)"
        >
          <app-icon name="building" [size]="18" [stroke]="1.8" />
          <span class="max-w-56 truncate">{{ currentName() }}</span>
          <app-icon name="chevron-down" [size]="16" />
        </button>
      } @else {
        <button
          type="button"
          class="tap flex w-full items-center gap-3 rounded-2xl border border-line-2 bg-white p-3.5 text-left"
          aria-haspopup="listbox"
          (click)="list.toggle($event)"
        >
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-chip text-ink-2"
          >
            <app-icon name="building" [size]="20" [stroke]="1.8" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-xs text-muted">{{ 'hotels.current' | transloco }}</span>
            <span class="truncate text-[15px] font-semibold">{{ currentName() }}</span>
          </span>
          <app-icon name="chevron-down" class="text-faint" />
        </button>
      }
      <p-popover #list>
        <ul role="listbox" class="m-0 flex w-72 list-none flex-col gap-0.5 p-0">
          @for (h of auth.hotels(); track h.id) {
            <li>
              <button
                type="button"
                role="option"
                class="hotel-row"
                [attr.aria-selected]="h.id === auth.hotelId()"
                [disabled]="!h.active"
                (click)="list.hide(); pick(h)"
              >
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-sm font-semibold">{{ h.name }}</span>
                  <span class="truncate text-xs text-muted">
                    {{ h.city }}
                    @if (!h.active) {
                      · {{ 'hotels.blocked' | transloco }}
                    }
                  </span>
                </span>
                @if (h.id === auth.hotelId()) {
                  <app-icon name="check" [size]="18" class="text-accent" />
                }
              </button>
            </li>
          }
        </ul>
      </p-popover>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .switch-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      padding: 0 12px;
      border: 1px solid var(--color-line);
      border-radius: 8px;
      background: #fff;
      color: var(--color-ink);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .switch-btn:hover {
      background: #f9fafb;
    }
    .hotel-row {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      text-align: left;
      color: var(--color-ink);
      cursor: pointer;
    }
    .hotel-row:hover:not(:disabled),
    .hotel-row[aria-selected='true'] {
      background: #f2f4f7;
    }
    .hotel-row:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class HotelSwitcher {
  readonly variant = input<'header' | 'block'>('header');
  protected readonly auth = inject(AuthService);

  protected readonly currentName = computed(() => {
    const id = this.auth.hotelId();
    return this.auth.hotels().find((h) => h.id === id)?.name ?? this.auth.user()?.hotelName ?? '';
  });

  protected pick(h: HotelItem): void {
    if (h.active && h.id !== this.auth.hotelId()) {
      this.auth.switchHotel(h.id);
    }
  }
}

/**
 * Окно выбора отеля: после входа, если отелей несколько и ни один не выбран,
 * и при ответах 422 hotel.required / 403 hotel.forbidden. Закрыть нельзя — только выбрать или выйти.
 */
@Component({
  selector: 'app-hotel-picker',
  imports: [TranslocoPipe, ButtonModule, Dialog, Icon],
  template: `
    <p-dialog
      [visible]="open()"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closable]="false"
      [closeOnEscape]="false"
      [header]="'hotels.pickTitle' | transloco"
      [style]="{ width: '440px', maxWidth: 'calc(100vw - 32px)' }"
    >
      <div class="flex flex-col gap-3">
        @if (auth.hotels().length) {
          <p class="m-0 text-sm leading-normal text-muted">{{ 'hotels.pickText' | transloco }}</p>
          <div class="flex flex-col gap-2">
            @for (h of auth.hotels(); track h.id) {
              <button
                type="button"
                class="flex items-center gap-3 rounded-xl border border-line bg-white p-3 text-left enabled:cursor-pointer enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                [disabled]="!h.active || busy()"
                (click)="pick(h)"
              >
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-chip text-ink-2"
                >
                  <app-icon name="building" [size]="20" [stroke]="1.8" />
                </span>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-sm font-semibold">{{ h.name }}</span>
                  <span class="truncate text-xs text-muted">{{ h.city }}</span>
                </span>
                @if (!h.active) {
                  <span class="text-xs font-semibold text-danger">{{
                    'hotels.blocked' | transloco
                  }}</span>
                }
              </button>
            }
          </div>
        } @else {
          <p class="m-0 text-sm leading-normal text-muted">{{ 'hotels.none' | transloco }}</p>
        }
        <button
          pButton
          type="button"
          severity="secondary"
          [outlined]="true"
          class="mt-1"
          (click)="logout()"
        >
          <span pButtonLabel>{{ 'shell.logout' | transloco }}</span>
        </button>
      </div>
    </p-dialog>
  `,
})
export class HotelPicker {
  protected readonly auth = inject(AuthService);
  protected readonly busy = signal(false);
  protected readonly open = computed(
    () => this.auth.isLoggedIn() && !this.auth.isPlatformAdmin() && this.auth.hotelRequired(),
  );

  protected pick(h: HotelItem): void {
    if (!h.active) {
      return;
    }
    this.busy.set(true);
    this.auth.switchHotel(h.id);
  }

  protected logout(): void {
    this.auth.logout();
    location.assign('/login');
  }
}
