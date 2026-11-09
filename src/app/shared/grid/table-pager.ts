import { Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Select } from 'primeng/select';
import { Icon } from '../ui/icon/icon';

/** Подвал таблицы: «Показано 1–10 из 18», «Строк на странице», номера страниц. */
@Component({
  selector: 'app-table-pager',
  imports: [FormsModule, Select, Icon, TranslocoPipe],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line-2 px-5 py-3">
      <div class="flex flex-wrap items-center gap-3 text-[13px] text-muted">
        <span aria-live="polite">
          @if (total() === 0) {
            {{ 'grid.zeroRecords' | transloco }}
          } @else {
            {{ 'grid.range' | transloco: { from: from(), to: to(), total: total() } }}
          }
        </span>
        <label class="flex items-center gap-2">
          {{ 'grid.pageSize' | transloco }}
          <p-select
            size="small"
            [options]="sizes"
            [ngModel]="pageSize()"
            (ngModelChange)="pageSize.set($event)"
            [ariaLabel]="'grid.pageSize' | transloco"
            appendTo="body"
          />
        </label>
      </div>
      <nav class="flex items-center gap-1" [attr.aria-label]="'grid.pages' | transloco">
        <button
          type="button"
          class="pager-btn"
          [attr.aria-label]="'grid.prev' | transloco"
          [disabled]="page() <= 0"
          (click)="go.emit(page() - 1)"
        >
          <app-icon name="chevron-left" [size]="16" />
        </button>
        @for (p of pages(); track $index) {
          @if (p === -1) {
            <span class="px-1 text-sm text-muted" aria-hidden="true">…</span>
          } @else {
            <button
              type="button"
              class="pager-btn"
              [class.pager-current]="p === page()"
              [attr.aria-current]="p === page() ? 'page' : null"
              (click)="go.emit(p)"
            >
              {{ p + 1 }}
            </button>
          }
        }
        <button
          type="button"
          class="pager-btn"
          [attr.aria-label]="'grid.next' | transloco"
          [disabled]="page() >= pageCount() - 1"
          (click)="go.emit(page() + 1)"
        >
          <app-icon name="chevron-right" [size]="16" />
        </button>
      </nav>
    </div>
  `,
  styles: `
    .pager-btn {
      min-width: 36px;
      height: 36px;
      padding: 0 8px;
      border: 1px solid #d0d5dd;
      border-radius: 8px;
      background: #fff;
      color: #344054;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition:
        background-color 0.18s,
        border-color 0.18s;
    }
    .pager-btn:hover:not(:disabled) {
      background: #f2f4f7;
    }
    .pager-btn:disabled {
      background: #f9fafb;
      color: #98a2b3;
      border-color: #eaecf0;
      cursor: not-allowed;
    }
    .pager-current,
    .pager-current:hover:not(:disabled) {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: #fff;
    }
  `,
})
export class TablePager {
  /** Текущая страница (с нуля). */
  readonly page = input(0);
  readonly pageCount = input(1);
  readonly total = input(0);
  readonly pageSize = model(10);
  readonly go = output<number>();

  protected readonly sizes = [5, 10, 20];

  protected readonly from = computed(() => this.page() * this.pageSize() + 1);
  protected readonly to = computed(() =>
    Math.min((this.page() + 1) * this.pageSize(), this.total()),
  );

  /** Номера страниц с многоточием: 0 1 … 5 6 7 … 12. */
  protected readonly pages = computed(() => {
    const count = Math.max(1, this.pageCount());
    const cur = this.page();
    if (count <= 7) {
      return Array.from({ length: count }, (_, i) => i);
    }
    const set = new Set([0, count - 1, cur - 1, cur, cur + 1].filter((p) => p >= 0 && p < count));
    const sorted = [...set].sort((a, b) => a - b);
    const out: number[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) {
        out.push(-1);
      }
      out.push(p);
    });
    return out;
  });
}
