import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { NotifyService } from '../../core/notify/notify.service';
import { PaymentStatus, RoomStatus } from '../../core/models';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Icon } from '../../shared/ui/icon/icon';
import { PayBadge, RoomStatusBadge } from '../../shared/ui/status/badges';

/** Витрина UI-компонентов HotelOS: состояния кнопок, полей, статусы, таблицы, попапы. */
@Component({
  selector: 'app-ui-kit',
  imports: [TranslocoPipe, ButtonModule, InputText, Icon, RoomStatusBadge, PayBadge, EmptyState],
  template: `
    <div
      class="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-10 max-md:px-4 max-md:py-5"
    >
      <div>
        <h1 class="m-0 text-[28px] font-bold tracking-[-0.01em]">
          {{ 'uikit.title' | transloco }}
        </h1>
        <p class="mt-1.5 mb-0 text-sm text-muted">{{ 'uikit.subtitle' | transloco }}</p>
      </div>

      <section class="kit-card">
        <h2 class="kit-title">{{ 'uikit.buttons' | transloco }}</h2>
        <div class="grid grid-cols-[140px_1fr] items-center gap-x-5 gap-y-4 max-md:grid-cols-1">
          <span class="text-[13px] text-muted">{{ 'uikit.primary' | transloco }}</span>
          <div class="flex flex-wrap gap-2.5">
            <button pButton type="button">
              <app-icon name="plus" /><span pButtonLabel>{{ 'common.add' | transloco }}</span>
            </button>
            <button pButton type="button" [loading]="busy()" (click)="fakeSave()">
              @if (!busy()) {
                <app-icon name="check" />
              }
              <span pButtonLabel>{{ (busy() ? 'uikit.saving' : 'common.save') | transloco }}</span>
            </button>
            <button pButton type="button" [disabled]="true">
              <app-icon name="check" /><span pButtonLabel>{{
                'uikit.unavailable' | transloco
              }}</span>
            </button>
          </div>
          <span class="text-[13px] text-muted">{{ 'uikit.secondary' | transloco }}</span>
          <div class="flex flex-wrap gap-2.5">
            <button pButton type="button" severity="secondary" [outlined]="true">
              <app-icon name="edit" /><span pButtonLabel>{{ 'common.edit' | transloco }}</span>
            </button>
            <button pButton type="button" severity="secondary" [outlined]="true" [disabled]="true">
              <app-icon name="edit" /><span pButtonLabel>{{ 'common.edit' | transloco }}</span>
            </button>
            <button
              pButton
              type="button"
              severity="secondary"
              [outlined]="true"
              class="w-[42px] !px-0"
              [attr.aria-label]="'common.refresh' | transloco"
            >
              <app-icon name="refresh" />
            </button>
          </div>
          <span class="text-[13px] text-muted">{{ 'uikit.danger' | transloco }}</span>
          <div class="flex flex-wrap gap-2.5">
            <button pButton type="button" severity="danger" [outlined]="true">
              <app-icon name="trash" /><span pButtonLabel>{{ 'common.delete' | transloco }}</span>
            </button>
            <button pButton type="button" severity="danger" [outlined]="true" [disabled]="true">
              <app-icon name="trash" /><span pButtonLabel>{{ 'common.delete' | transloco }}</span>
            </button>
            <button pButton type="button" severity="danger">
              <app-icon name="trash" /><span pButtonLabel>{{ 'common.delete' | transloco }}</span>
            </button>
          </div>
        </div>
      </section>

      <div class="flex flex-wrap gap-6">
        <section class="kit-card flex-[1_1_460px]">
          <h2 class="kit-title">{{ 'uikit.inputs' | transloco }}</h2>
          <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div class="field">
              <label for="k-1" class="field-label">{{ 'uikit.normal' | transloco }}</label>
              <input id="k-1" pInputText [placeholder]="'uikit.typeText' | transloco" />
            </div>
            <div class="field">
              <label for="k-2" class="field-label">{{ 'uikit.focused' | transloco }}</label>
              <input
                id="k-2"
                pInputText
                value="Каримов"
                class="!border-accent !shadow-[0_0_0_3px_rgba(15,118,110,.15)]"
              />
            </div>
            <div class="field">
              <label for="k-3" class="field-label"
                >{{ 'uikit.error' | transloco }} <span class="req">*</span></label
              >
              <input
                id="k-3"
                pInputText
                [invalid]="true"
                aria-invalid="true"
                aria-describedby="k-3-err"
              />
              <span id="k-3-err" class="text-xs text-danger">{{
                'common.required' | transloco
              }}</span>
            </div>
            <div class="field">
              <label for="k-4" class="field-label text-faint">{{
                'uikit.disabled' | transloco
              }}</label>
              <input id="k-4" pInputText value="AB 1234567" disabled />
            </div>
          </div>
        </section>

        <section class="kit-card flex-[1_1_460px]">
          <h2 class="kit-title">{{ 'uikit.statuses' | transloco }}</h2>
          <div class="flex flex-wrap gap-2.5">
            @for (s of roomStatuses; track s) {
              <app-room-status [status]="s" />
            }
          </div>
          <div class="flex flex-wrap gap-2.5">
            @for (p of payStatuses; track p) {
              <app-pay-badge [status]="p" />
            }
          </div>
        </section>
      </div>

      <div class="flex flex-wrap gap-6">
        <section class="kit-card flex-[1_1_460px] !gap-0 overflow-hidden !p-0">
          <div class="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
            <h2 class="kit-title">{{ 'uikit.tableLoading' | transloco }}</h2>
            <span class="text-xs text-muted">{{ 'uikit.skeletonHint' | transloco }}</span>
          </div>
          <div
            class="grid grid-cols-[2fr_1fr_1fr] gap-3 border-y border-line-2 bg-subtle px-6 py-2.5 text-xs font-semibold text-muted"
          >
            <span>{{ 'guests.col.name' | transloco }} ↕</span
            ><span>{{ 'guests.col.room' | transloco }} ↕</span
            ><span>{{ 'guests.col.sum' | transloco }} ↕</span>
          </div>
          @for (s of [0, 1, 2, 3]; track s) {
            <div
              class="grid h-12 grid-cols-[2fr_1fr_1fr] items-center gap-3 border-b border-line-2 px-6"
            >
              <div class="sk h-3 w-4/5"></div>
              <div class="sk h-3 w-1/2"></div>
              <div class="sk h-3 w-[70%]"></div>
            </div>
          }
        </section>
        <section class="kit-card flex-[1_1_460px] !gap-0 overflow-hidden !p-0">
          <div class="px-6 pt-5 pb-3">
            <h2 class="kit-title">{{ 'uikit.tableEmpty' | transloco }}</h2>
          </div>
          <div
            class="grid grid-cols-[2fr_1fr_1fr] gap-3 border-y border-line-2 bg-subtle px-6 py-2.5 text-xs font-semibold text-muted"
          >
            <span>{{ 'guests.col.name' | transloco }} ↕</span
            ><span>{{ 'guests.col.room' | transloco }} ↕</span
            ><span>{{ 'guests.col.sum' | transloco }} ↕</span>
          </div>
          <app-empty-state text="common.noMatches" actionLabel="common.resetFilters" />
        </section>
      </div>

      <section class="kit-card">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="kit-title">{{ 'uikit.popups' | transloco }}</h2>
          <div class="flex flex-wrap gap-2">
            <button
              pButton
              type="button"
              severity="secondary"
              [outlined]="true"
              (click)="demo(true)"
            >
              <app-icon name="check" /><span pButtonLabel>{{
                'uikit.showSuccess' | transloco
              }}</span>
            </button>
            <button
              pButton
              type="button"
              severity="secondary"
              [outlined]="true"
              (click)="demo(false)"
            >
              <app-icon name="close" /><span pButtonLabel>{{ 'uikit.showError' | transloco }}</span>
            </button>
          </div>
        </div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          @for (s of samples; track s.title) {
            <div
              class="flex flex-col items-center gap-2.5 rounded-2xl border border-line-2 px-5 py-6 text-center shadow-[0_8px_20px_rgba(16,24,40,.06)]"
            >
              <div
                class="flex size-[60px] items-center justify-center rounded-full"
                [class]="s.ok ? 'bg-[#E7F6EC] text-[#067647]' : 'bg-[#FEE4E2] text-danger'"
              >
                <app-icon [name]="s.ok ? 'check' : 'close'" [size]="30" [stroke]="2.4" />
              </div>
              <span class="text-base font-semibold">{{ s.title | transloco: s.params }}</span>
              <span class="text-[13px] leading-normal text-muted">{{
                s.text | transloco: s.params
              }}</span>
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    .kit-card {
      background: #fff;
      border: 1px solid #e4e7ec;
      border-radius: 14px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .kit-title {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
    }
  `,
})
export class UiKitPage {
  private readonly notify = inject(NotifyService);
  protected readonly busy = signal(false);
  protected readonly roomStatuses: RoomStatus[] = ['free', 'busy', 'clean', 'repair'];
  protected readonly payStatuses: PaymentStatus[] = ['paid', 'part', 'wait'];
  protected readonly samples = [
    {
      ok: true,
      title: 'guests.reg.doneTitle',
      text: 'guests.reg.doneText',
      params: { name: 'Hoffmann Lena', room: '302' },
    },
    {
      ok: true,
      title: 'guests.reg.foundTitle',
      text: 'guests.reg.foundText',
      params: { name: 'Турсунов Азамат' },
    },
    {
      ok: false,
      title: 'guests.reg.requiredTitle',
      text: 'guests.reg.requiredText',
      params: { fields: 2 },
    },
    {
      ok: false,
      title: 'guests.reg.notFoundTitle',
      text: 'guests.reg.notFoundText',
      params: { doc: 'AB 0000000' },
    },
  ];

  protected fakeSave(): void {
    this.busy.set(true);
    setTimeout(() => {
      this.busy.set(false);
      this.notify.success('common.savedTitle', 'uikit.savedText');
    }, 1200);
  }

  protected demo(ok: boolean): void {
    const s = this.samples[ok ? 0 : 2];
    if (ok) {
      this.notify.success(s.title, s.text, s.params);
    } else {
      this.notify.error(s.title, s.text, s.params);
    }
  }
}
