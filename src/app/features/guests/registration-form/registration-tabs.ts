import { Component, computed, inject, input, output, signal, viewChildren } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { ApiError } from '../../../core/api/mock-api';
import { BlacklistService } from '../../../core/data/blacklist.service';
import { BookService } from '../../../core/data/book.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { BlacklistEntry, GuestRegistration } from '../../../core/models';
import { Icon } from '../../../shared/ui/icon/icon';
import { BlacklistWarning } from '../../blacklist/blacklist-warning';
import { RegistrationForm, RegStay } from './registration-form';

interface RegTab {
  id: number;
  /** Проживание, скопированное из таба, в котором нажали «+». */
  stay: RegStay | null;
}

const normalizeDoc = (doc: string) => doc.replace(/\s+/g, '').toUpperCase();

/**
 * Регистрация (с заселением) нескольких гостей в одной модалке: каждый гость — отдельный таб с формой.
 * «+» добавляет таб и переносит в него номер, даты и цель визита из текущего гостя.
 * Кнопка «Зарегистрировать» проверяет все табы и регистрирует всех гостей разом.
 */
@Component({
  selector: 'app-registration-tabs',
  imports: [TranslocoPipe, ButtonModule, Icon, RegistrationForm, BlacklistWarning],
  template: `
    <div class="flex flex-col" [class.gap-5]="!compact()" [class.gap-4]="compact()">
      <div class="flex items-center gap-2">
        <div
          role="group"
          [attr.aria-label]="'guests.reg.guestsGroup' | transloco"
          class="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto"
        >
          @for (t of tabs(); track t.id; let i = $index) {
            <div
              class="flex h-10 shrink-0 items-center rounded-xl border transition-colors"
              [class]="
                t.id === active()
                  ? 'border-accent bg-accent-tint text-accent'
                  : 'border-line bg-white text-ink-2 hover:border-faint'
              "
            >
              <button
                type="button"
                class="flex h-full cursor-pointer items-center gap-2 rounded-xl border-0 bg-transparent pr-2 pl-3 text-[13px] font-semibold text-inherit"
                [class.pr-3]="tabs().length === 1"
                [attr.aria-pressed]="t.id === active()"
                (click)="active.set(t.id)"
              >
                <app-icon name="user" [size]="16" [stroke]="2" />
                <span class="max-w-44 truncate">
                  {{ labels()[i] || ('guests.reg.guestN' | transloco: { n: i + 1 }) }}
                </span>
              </button>
              @if (tabs().length > 1) {
                <button
                  type="button"
                  class="mr-1 flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted transition-colors hover:bg-chip hover:text-ink"
                  [attr.aria-label]="'guests.reg.removeGuest' | transloco: { n: i + 1 }"
                  [title]="'guests.reg.removeGuest' | transloco: { n: i + 1 }"
                  (click)="removeTab(t.id)"
                >
                  <app-icon name="close" [size]="14" [stroke]="2.2" />
                </button>
              }
            </div>
          }
        </div>
        <button
          pButton
          type="button"
          severity="secondary"
          [outlined]="true"
          class="size-10 shrink-0 !px-0"
          [attr.aria-label]="'guests.reg.addGuest' | transloco"
          [title]="'guests.reg.addGuest' | transloco"
          [disabled]="saving()"
          (click)="addTab()"
        >
          <app-icon name="plus" [stroke]="2.2" />
        </button>
      </div>

      @for (t of tabs(); track t.id) {
        <div [hidden]="t.id !== active()">
          <app-registration-form
            [multi]="true"
            [compact]="compact()"
            [presetRoom]="presetRoom()"
            [initialStay]="t.stay"
            (submitRequest)="submit()"
          />
        </div>
      }

      <div class="flex gap-2.5" [class.justify-end]="!compact()" [class.reg-actions]="!compact()">
        @if (!compact()) {
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            (click)="cancel.emit()"
          >
            <span pButtonLabel>{{ 'common.cancel' | transloco }}</span>
          </button>
        }
        <button
          pButton
          type="button"
          [loading]="saving()"
          [class.w-full]="compact()"
          [class.h-12]="compact()"
          (click)="submit()"
        >
          @if (!saving()) {
            <app-icon name="check" />
          }
          <span pButtonLabel>{{
            'book.submitCheckIn'
              | transloco: { count: tabs().length > 1 ? ' (' + tabs().length + ')' : '' }
          }}</span>
        </button>
      </div>
    </div>

    <app-blacklist-warning
      [(visible)]="warnOpen"
      [entries]="banned()"
      (proceed)="save(pending, true)"
    />
  `,
})
export class RegistrationTabs {
  private readonly book = inject(BookService);
  private readonly blacklist = inject(BlacklistService);
  private readonly notify = inject(NotifyService);

  /** Номер комнаты, выбранный заранее (из карточки номера). */
  readonly presetRoom = input<string | null>(null);
  readonly compact = input(false);
  readonly done = output<void>();
  readonly cancel = output<void>();

  /** Формы в порядке табов (совпадает с порядком в DOM). */
  private readonly forms = viewChildren(RegistrationForm);

  protected readonly tabs = signal<RegTab[]>([{ id: 1, stay: null }]);
  protected readonly active = signal(1);
  protected readonly saving = signal(false);
  private nextId = 2;

  // Предупреждение о чёрном списке
  protected readonly warnOpen = signal(false);
  protected readonly banned = signal<BlacklistEntry[]>([]);
  protected pending: GuestRegistration[] = [];

  /** Подписи табов: «Фамилия Имя», пока не введено — «Гость N». */
  protected readonly labels = computed(() => this.forms().map((f) => f.displayName()));

  protected addTab(): void {
    const index = this.tabs().findIndex((t) => t.id === this.active());
    const stay = this.forms()[index]?.stay() ?? null;
    const id = this.nextId++;
    this.tabs.update((list) => [...list, { id, stay }]);
    this.active.set(id);
  }

  protected removeTab(id: number): void {
    const list = this.tabs();
    if (list.length === 1) {
      return;
    }
    const index = list.findIndex((t) => t.id === id);
    const next = list.filter((t) => t.id !== id);
    this.tabs.set(next);
    if (this.active() === id) {
      this.active.set(next[Math.min(index, next.length - 1)].id);
    }
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    const tabs = this.tabs();
    const forms = this.forms();
    const list: GuestRegistration[] = [];
    for (let i = 0; i < forms.length; i++) {
      const check = forms[i].collect();
      if (!check.ok) {
        this.active.set(tabs[i].id);
        this.notify.error(check.title, check.text, check.params);
        return;
      }
      list.push(check.data);
    }
    const seen = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      const doc = normalizeDoc(list[i].doc);
      if (seen.has(doc)) {
        this.active.set(tabs[i].id);
        this.notify.error('guests.reg.duplicateTitle', 'guests.reg.duplicateText', {
          doc: list[i].doc,
        });
        return;
      }
      seen.add(doc);
    }

    const banned = list
      .map((d) => this.blacklist.find(d.doc))
      .filter((e): e is BlacklistEntry => e !== null);
    if (banned.length) {
      this.pending = list;
      this.banned.set(banned);
      this.warnOpen.set(true);
      return;
    }
    this.save(list);
  }

  /** confirmed — администратор подтвердил заселение гостя из чёрного списка. */
  protected save(list: GuestRegistration[], confirmed = false): void {
    const name = (d: GuestRegistration) => `${d.lastName} ${d.firstName}`.trim();
    this.saving.set(true);
    this.book.register(list, confirmed).subscribe({
      next: () => {
        this.saving.set(false);
        if (list.length === 1) {
          this.notify.success(
            'guests.reg.doneTitle',
            list[0].sendEmehmon ? 'guests.reg.doneTextEmehmon' : 'guests.reg.doneText',
            { name: name(list[0]), room: list[0].room },
          );
        } else {
          this.notify.success('guests.reg.doneGroupTitle', 'guests.reg.doneGroupText', {
            count: list.length,
            rooms: [...new Set(list.map((d) => d.room))].join(', '),
          });
        }
        this.done.emit();
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.notify.error(
          'common.saveError',
          e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
        );
      },
    });
  }
}
