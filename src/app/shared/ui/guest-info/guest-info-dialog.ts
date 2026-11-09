import { Component, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { initials } from '../../format/format';
import { Icon } from '../icon/icon';

/** Строка карточки: подпись — ключ i18n, значение — готовый текст (пусто → «—»). */
export interface GuestInfoItem {
  label: string;
  value: string;
  /** Значение — ключ i18n (страна, пол, тип документа…). */
  translate?: boolean;
  /** Строка на всю ширину (адрес, «кем выдан»). */
  wide?: boolean;
}

export interface GuestInfoSection {
  /** Ключ i18n заголовка раздела. */
  title: string;
  items: GuestInfoItem[];
}

export interface GuestInfo {
  name: string;
  /** Подпись под именем: документ, номер комнаты… */
  sub: string;
  banned: boolean;
  /** Причина из чёрного списка (если есть). */
  bannedReason?: string;
  sections: GuestInfoSection[];
}

/** Полная информация о госте (двойной клик по строке в «Книге» и «Гостях»). */
@Component({
  selector: 'app-guest-info-dialog',
  imports: [TranslocoPipe, ButtonModule, Dialog, Icon],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [dismissableMask]="true"
      [header]="'guestInfo.title' | transloco"
      [style]="{ width: '1040px', maxWidth: 'calc(100vw - 32px)' }"
      [contentStyle]="{ maxHeight: 'calc(100dvh - 150px)' }"
      styleClass="hs-dialog"
      [closeAriaLabel]="'common.close' | transloco"
    >
      @if (info(); as g) {
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-3.5">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              [class]="g.banned ? 'bg-[#FEE4E2] text-danger' : 'bg-accent text-white'"
              aria-hidden="true"
              >{{ initialsOf(g.name) }}</span
            >
            <div class="flex min-w-0 flex-col gap-0.5">
              <span class="text-base font-semibold">{{ g.name }}</span>
              <span class="text-[13px] text-muted">{{ g.sub }}</span>
            </div>
          </div>
          @if (g.banned) {
            <div
              class="flex items-start gap-2.5 rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger"
              role="note"
            >
              <app-icon name="ban" [size]="18" class="mt-px" />
              <span class="flex flex-col gap-0.5">
                <span class="font-semibold">{{ 'book.banned' | transloco }}</span>
                @if (g.bannedReason) {
                  <span class="text-ink-2">{{ g.bannedReason }}</span>
                }
              </span>
            </div>
          }
          @for (s of g.sections; track s.title) {
            <section class="flex flex-col gap-1.5">
              <h3 class="reg-legend m-0">{{ s.title | transloco }}</h3>
              <!-- 4 колонки на широком экране — карточка помещается без прокрутки -->
              <dl
                class="m-0 grid grid-cols-4 gap-x-6 gap-y-2 text-sm max-lg:grid-cols-2 max-sm:grid-cols-1"
              >
                @for (it of s.items; track it.label) {
                  <div class="flex min-w-0 flex-col gap-0.5" [class.col-span-2]="it.wide" [class.max-sm:col-span-1]="it.wide">
                    <dt class="text-xs text-muted">{{ it.label | transloco }}</dt>
                    <dd class="m-0 font-medium break-words text-ink">
                      @if (!it.value) {
                        —
                      } @else if (it.translate) {
                        {{ it.value | transloco }}
                      } @else {
                        {{ it.value }}
                      }
                    </dd>
                  </div>
                }
              </dl>
            </section>
          }
        </div>
      }
      <ng-template #footer>
        <ng-content select="[infoActions]" />
        <button pButton type="button" severity="secondary" [outlined]="true" (click)="visible.set(false)">
          <span pButtonLabel>{{ 'common.close' | transloco }}</span>
        </button>
      </ng-template>
    </p-dialog>
  `,
})
export class GuestInfoDialog {
  readonly visible = model(false);
  readonly info = input<GuestInfo | null>(null);

  protected initialsOf(name: string): string {
    return initials(name);
  }
}
