import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ColDef } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { CommentsService } from '../../core/data/comments.service';
import { LanguageService } from '../../core/i18n/language.service';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { CommentStatus, GuestComment } from '../../core/models';
import { NotifyService } from '../../core/notify/notify.service';
import { formatDateTime, formatTime, initials, localDateToIso } from '../../shared/format/format';
import { DayMonthPipe } from '../../shared/format/format.pipes';
import { pillCell } from '../../shared/grid/cells';
import { DataGrid } from '../../shared/grid/data-grid';
import { dateFilter } from '../../shared/grid/grid-filters';
import { Icon } from '../../shared/ui/icon/icon';
import { Sheet } from '../../shared/ui/sheet/sheet';

type Tab = CommentStatus | 'all';

const STATUS_TONE: Record<CommentStatus, { bg: string; fg: string; dot: string }> = {
  new: { bg: '#FEF0C7', fg: '#7A3A0A', dot: '#E8A54B' },
  read: { bg: '#F2F4F7', fg: '#344054', dot: '#98A2B3' },
};

/** Звёзды оценки для ячейки таблицы (без innerHTML). */
function starsCell(rating: number, label: string): HTMLElement {
  const wrap = document.createElement('span');
  wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px';
  const stars = document.createElement('span');
  stars.setAttribute('aria-hidden', 'true');
  stars.style.cssText = 'font-size:15px;letter-spacing:1px;white-space:nowrap';
  const on = document.createElement('span');
  on.style.color = '#E8A54B';
  on.textContent = '★'.repeat(rating);
  const off = document.createElement('span');
  off.style.color = '#D0D5DD';
  off.textContent = '★'.repeat(5 - rating);
  stars.append(on, off);
  const n = document.createElement('span');
  n.style.cssText = 'font-size:13px;font-weight:600;color:#344054';
  n.textContent = label;
  wrap.append(stars, n);
  return wrap;
}

/** «№ 203» — серая плашка номера. */
function roomCell(room: string): HTMLElement {
  const el = document.createElement('span');
  el.style.cssText =
    'display:inline-flex;align-items:center;height:26px;padding:0 9px;border-radius:6px;background:#F2F4F7;font-size:13px;font-weight:600;color:#344054';
  el.textContent = `№ ${room}`;
  return el;
}

@Component({
  selector: 'app-comments',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
    ButtonModule,
    Dialog,
    DataGrid,
    Icon,
    Sheet,
    DayMonthPipe,
  ],
  templateUrl: './comments.html',
})
export class CommentsPage {
  private readonly api = inject(CommentsService);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService);
  protected readonly bp = inject(BreakpointService);

  protected readonly items = computed(() => this.api.items() ?? []);
  protected readonly loading = computed(() => !this.api.loaded());
  protected readonly offline = computed(() => this.api.error() && this.api.items() === null);
  protected readonly refreshing = signal(false);

  protected readonly tab = signal<Tab>('all');
  protected readonly openId = signal<number | null>(null);
  protected readonly busy = signal(false);

  protected readonly newCount = this.api.newCount;

  protected readonly stats = computed(() => {
    const list = this.items();
    const avg = list.length ? list.reduce((s, c) => s + c.rating, 0) / list.length : null;
    return {
      new: this.newCount(),
      total: list.length,
      avg: avg === null ? '—' : avg.toFixed(1).replace('.', ','),
    };
  });

  protected readonly tabs = computed(() => {
    const list = this.items();
    return (['all', 'new', 'read'] as Tab[]).map((key) => ({
      key,
      dot: key === 'all' ? '#475467' : STATUS_TONE[key].dot,
      count: key === 'all' ? list.length : list.filter((c) => c.status === key).length,
    }));
  });

  protected readonly rows = computed(() => {
    const t = this.tab();
    return t === 'all' ? this.items() : this.items().filter((c) => c.status === t);
  });

  protected readonly open = computed(
    () => this.items().find((c) => c.id === this.openId()) ?? null,
  );
  protected readonly detailOpen = signal(false);

  // ===== Десктоп: таблица =====
  protected readonly columns = computed<ColDef<GuestComment>[]>(() => {
    this.lang.current();
    const t = (k: string, p?: Record<string, unknown>) => this.transloco.translate(k, p);
    const anon = t('comments.anonymous');
    const cols: ColDef<GuestComment>[] = [
      {
        field: 'at',
        headerName: t('comments.col.at'),
        flex: 1.15,
        minWidth: 170,
        sort: 'desc',
        valueFormatter: (p) => formatDateTime(p.value),
        ...dateFilter<GuestComment>(),
        cellClass: 'text-ink-2 tabular-nums',
      },
      {
        field: 'room',
        headerName: t('comments.col.room'),
        flex: 0.7,
        minWidth: 110,
        comparator: (a: string, b: string) => a.localeCompare(b, 'ru', { numeric: true }),
        cellRenderer: (p: { value: string }) => roomCell(p.value),
      },
      {
        colId: 'guest',
        headerName: t('comments.col.guest'),
        flex: 1.2,
        valueGetter: (p) => p.data?.guest || anon,
        cellClassRules: { 'italic text-muted': (p) => !p.data?.guest },
      },
      {
        field: 'rating',
        headerName: t('comments.col.rating'),
        flex: 1,
        minWidth: 140,
        filterValueGetter: (p) => String(p.data?.rating ?? ''),
        cellRenderer: (p: { value: number }) =>
          starsCell(p.value, t('comments.ratingOf', { n: p.value })),
      },
      {
        field: 'text',
        headerName: t('comments.col.text'),
        flex: 3,
        minWidth: 260,
        cellClassRules: { 'font-semibold text-ink': (p) => p.data?.status === 'new' },
        cellClass: 'truncate',
      },
      {
        field: 'status',
        headerName: t('comments.col.status'),
        flex: 0.9,
        minWidth: 120,
        valueFormatter: (p) => t(`comments.status.${p.value}`),
        filterValueGetter: (p) => t(`comments.status.${p.data?.status ?? 'read'}`),
        cellRenderer: (p: { value: CommentStatus }) => {
          const tone = STATUS_TONE[p.value];
          return pillCell(t(`comments.status.${p.value}`), tone.bg, tone.fg, tone.dot);
        },
      },
    ];
    return cols;
  });

  protected readonly rowId = (p: { data: GuestComment }) => String(p.data.id);
  protected readonly rowClass = (c: GuestComment) =>
    c.status === 'new' ? 'hs-row-new cursor-pointer' : 'cursor-pointer';

  constructor() {
    this.api.watch(inject(DestroyRef));
  }

  protected reload(): void {
    this.refreshing.set(true);
    this.api.refresh().subscribe(() => this.refreshing.set(false));
  }

  protected openComment(c: GuestComment): void {
    this.openId.set(c.id);
    this.detailOpen.set(true);
    if (c.status === 'new') {
      this.api.setStatus(c.id, 'read').subscribe({ error: () => this.api.refresh().subscribe() });
    }
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
  }

  protected markNew(): void {
    const c = this.open();
    if (!c) {
      return;
    }
    this.detailOpen.set(false);
    this.api.setStatus(c.id, 'new').subscribe({ error: () => this.fail() });
  }

  protected remove(): void {
    const c = this.open();
    if (!c) {
      return;
    }
    this.busy.set(true);
    this.api.remove(c.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.detailOpen.set(false);
        this.notify.success('comments.deletedTitle', 'comments.deletedText', { room: c.room });
      },
      error: () => {
        this.busy.set(false);
        this.fail();
      },
    });
  }

  protected readAll(): void {
    this.api.readAll().subscribe({
      next: () => this.notify.success('comments.readAllTitle', 'comments.readAllText'),
      error: () => this.fail(),
    });
  }

  // ===== Вспомогательное =====
  protected stars(n: number): { on: string; off: string } {
    return { on: '★'.repeat(n), off: '★'.repeat(5 - n) };
  }

  protected guestInitials(c: GuestComment): string {
    return c.guest ? initials(c.guest) : '?';
  }

  /** Подпись времени для карточки на телефоне: «сегодня, 08:42», «вчера, 22:15», «24 окт». */
  protected when(at: string): { key: string; time?: string } {
    const day = at.slice(0, 10);
    const today = localDateToIso(new Date());
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (day === today) {
      return { key: 'comments.today', time: formatTime(at) };
    }
    if (day === localDateToIso(y)) {
      return { key: 'comments.yesterday', time: formatTime(at) };
    }
    return { key: '' };
  }

  private fail(): void {
    this.notify.error('common.saveError', 'errors.common.unknown');
    this.api.refresh().subscribe();
  }
}
