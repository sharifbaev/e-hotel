import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, input, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { LedgerKind } from '../../core/models';
import { ExpensesPage } from '../expenses/expenses';

/** Вкладка в адресе: /payments?tab=expenses | services | debts */
const TABS: { kind: LedgerKind; param: string; label: string }[] = [
  { kind: 'expense', param: 'expenses', label: 'payments.tabs.expenses' },
  { kind: 'service', param: 'services', label: 'payments.tabs.services' },
  { kind: 'debt', param: 'debts', label: 'payments.tabs.debts' },
];

/** «Платежи и расходы»: расходы, дополнительные сервисы и долги — одна таблица на вкладку. */
@Component({
  selector: 'app-payments',
  imports: [NgTemplateOutlet, TranslocoPipe, ExpensesPage],
  template: `
    @if (!bp.isMobile()) {
      <!-- Заголовок и вкладки — в одном ряду с кнопками вкладки (проецируются в app-expenses) -->
      <div class="page-fit flex flex-col pt-5">
        <ng-container *ngTemplateOutlet="tab; context: { $implicit: lead }" />
      </div>
      <ng-template #lead>
        <h1 class="m-0 text-2xl font-bold tracking-[-0.01em]">
          {{ 'payments.title' | transloco }}
        </h1>
        <div class="seg" role="tablist" [attr.aria-label]="'payments.title' | transloco">
          @for (t of tabs; track t.kind) {
            <button
              type="button"
              role="tab"
              [class.seg-on]="active() === t.kind"
              [attr.aria-selected]="active() === t.kind"
              (click)="setTab(t.kind)"
            >
              {{ t.label | transloco }}
            </button>
          }
        </div>
      </ng-template>
    } @else {
      <div class="flex shrink-0 flex-col gap-2.5 bg-white px-4 pt-3.5 pb-1">
        <h1 class="m-0 text-xl font-bold">{{ 'payments.title' | transloco }}</h1>
        <div class="seg seg-full" role="tablist" [attr.aria-label]="'payments.title' | transloco">
          @for (t of tabs; track t.kind) {
            <button
              type="button"
              role="tab"
              [class.seg-on]="active() === t.kind"
              [attr.aria-selected]="active() === t.kind"
              (click)="setTab(t.kind)"
            >
              {{ t.label | transloco }}
            </button>
          }
        </div>
      </div>
      <ng-container *ngTemplateOutlet="tab" />
    }

    <!-- Отдельный экземпляр на вкладку: у каждой своё выделение, форма и фильтры -->
    <ng-template #tab let-lead>
      @switch (active()) {
        @case ('expense') {
          <app-expenses kind="expense" embedded class="flex min-h-0 flex-1 flex-col">
            <ng-container *ngTemplateOutlet="lead" />
          </app-expenses>
        }
        @case ('service') {
          <app-expenses kind="service" embedded class="flex min-h-0 flex-1 flex-col">
            <ng-container *ngTemplateOutlet="lead" />
          </app-expenses>
        }
        @case ('debt') {
          <app-expenses kind="debt" embedded class="flex min-h-0 flex-1 flex-col">
            <ng-container *ngTemplateOutlet="lead" />
          </app-expenses>
        }
      }
    </ng-template>
  `,
})
export class PaymentsPage {
  private readonly router = inject(Router);
  protected readonly bp = inject(BreakpointService);
  protected readonly tabs = TABS;

  /** Query-параметр ?tab=… (withComponentInputBinding). */
  readonly tab = input<string>();
  protected readonly active = linkedSignal<LedgerKind>(
    () => TABS.find((t) => t.param === this.tab())?.kind ?? 'expense',
  );

  protected setTab(kind: LedgerKind): void {
    this.active.set(kind);
    const param = TABS.find((t) => t.kind === kind)?.param;
    void this.router.navigate([], {
      queryParams: { tab: param === 'expenses' ? null : param },
      replaceUrl: true,
    });
  }
}
