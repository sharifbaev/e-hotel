import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { DatePicker } from 'primeng/datepicker';
import { APP_TODAY } from '../../core/api/mock-api';
import { DashboardService } from '../../core/data/dashboard.service';
import { ExpensesService } from '../../core/data/expenses.service';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { DashboardMode, RoomStatus } from '../../core/models';
import { addDays, formatSum, isoToLocalDate, localDateToIso } from '../../shared/format/format';
import { DayMonthPipe, PluralPipe, SumPipe } from '../../shared/format/format.pipes';
import { PayBadge } from '../../shared/ui/status/badges';
import { ROOM_TONE } from '../../shared/ui/status/status-styles';
import { FinanceChart } from './finance-chart';

interface Kpi {
  label: string;
  value: string;
  /** Денежное значение (полная сумма) — шрифт чуть меньше, чтобы число помещалось. */
  money?: boolean;
  /** Сумма от 100 млн — показывается в миллионах, подпись «млн» добавляет шаблон. */
  mln?: boolean;
  note: string;
  noteParams?: Record<string, unknown>;
  noteClass: string;
  glyph: string;
  iconBg: string;
  iconFg: string;
  link: string;
  /** Мобильная карточка на всю ширину. */
  wide?: boolean;
}

const FUND_ORDER: RoomStatus[] = ['busy', 'free', 'clean', 'repair'];
const FUND_BAR: Record<RoomStatus, string> = {
  busy: '#0F766E',
  free: '#2E8B57',
  clean: '#E8A54B',
  repair: '#98A2B3',
};

@Component({
  selector: 'app-dashboard',
  imports: [
    FormsModule,
    RouterLink,
    TranslocoPipe,
    DatePicker,
    PayBadge,
    FinanceChart,
    SumPipe,
    DayMonthPipe,
    PluralPipe,
  ],
  templateUrl: './dashboard.html',
})
export class DashboardPage {
  private readonly dashboard = inject(DashboardService);
  private readonly expensesApi = inject(ExpensesService);
  protected readonly bp = inject(BreakpointService);
  protected readonly today = inject(APP_TODAY);

  protected readonly modes: DashboardMode[] = ['week', 'month', 'period'];
  protected readonly mode = signal<DashboardMode>('week');
  protected readonly periodFrom = signal<Date | null>(isoToLocalDate(addDays(this.today, -14)));
  protected readonly periodTo = signal<Date | null>(isoToLocalDate(this.today));

  /** Границы выбранного периода (ISO). */
  protected readonly range = computed(() => {
    const mode = this.mode();
    if (mode === 'week') {
      return { from: addDays(this.today, -6), to: this.today };
    }
    if (mode === 'month') {
      return { from: `${this.today.slice(0, 8)}01`, to: this.today };
    }
    let from = localDateToIso(this.periodFrom()) ?? addDays(this.today, -14);
    let to = localDateToIso(this.periodTo()) ?? this.today;
    if (from > to) {
      [from, to] = [to, from];
    }
    return { from, to };
  });

  private readonly summaryRes = rxResource({
    params: () => this.range(),
    stream: ({ params }) => this.dashboard.summary(params.from, params.to),
  });

  private readonly expensesRes = rxResource({
    stream: () => this.expensesApi.recent(4),
  });

  protected readonly loading = computed(() => this.summaryRes.isLoading());
  protected readonly summary = computed(() =>
    this.summaryRes.hasValue() ? this.summaryRes.value() : null,
  );
  protected readonly recentExpenses = computed(() =>
    this.expensesRes.hasValue() ? this.expensesRes.value() : [],
  );
  protected readonly expensesLoading = computed(() => this.expensesRes.isLoading());

  protected readonly totals = computed(() => {
    const daily = this.summary()?.daily ?? [];
    const revenue = daily.reduce((s, d) => s + d.revenue, 0);
    const expenses = daily.reduce((s, d) => s + d.expenses, 0);
    return { revenue, expenses, days: daily.length };
  });

  protected readonly kpis = computed<Kpi[]>(() => {
    const s = this.summary();
    const { revenue, expenses, days } = this.totals();
    return [
      {
        label: 'dashboard.kpi.occupancy',
        value: s ? `${s.occupancy}%` : '',
        note: 'dashboard.kpi.occupancyNote',
        noteParams: { delta: signed(s?.occupancyDelta ?? 0) },
        noteClass: (s?.occupancyDelta ?? 0) < 0 ? 'text-danger' : 'text-success',
        glyph: '%',
        iconBg: '#E6F4F2',
        iconFg: '#0B5A54',
        link: '/rooms',
      },
      {
        label: 'dashboard.kpi.arrivals',
        value: s ? String(s.arrivalsToday) : '',
        note: 'dashboard.kpi.arrivalsNote',
        noteParams: { count: s?.arrivalsWaitingPayment ?? 0 },
        noteClass: 'text-muted',
        glyph: '↘',
        iconBg: '#DCE7FD',
        iconFg: '#1E3A8A',
        link: '/rooms',
      },
      {
        label: 'dashboard.kpi.departures',
        value: s ? String(s.departuresToday) : '',
        note: 'dashboard.kpi.departuresNote',
        noteParams: { count: s?.lateCheckouts ?? 0 },
        noteClass: 'text-muted',
        glyph: '↗',
        iconBg: '#EEF0F3',
        iconFg: '#344054',
        link: '/rooms',
      },
      {
        label: 'dashboard.kpi.revenue',
        ...money(revenue),
        money: true,
        note: 'dashboard.kpi.revenueNote',
        noteParams: { days },
        noteClass: 'text-muted',
        glyph: '+',
        iconBg: '#E7F6EC',
        iconFg: '#166534',
        link: '/guests',
      },
      {
        label: 'dashboard.kpi.expenses',
        ...money(expenses),
        money: true,
        note: 'dashboard.kpi.expensesNote',
        noteParams: { pct: revenue ? Math.round((expenses / revenue) * 100) : 0 },
        noteClass: 'text-danger',
        glyph: '−',
        iconBg: '#FEECEB',
        iconFg: '#B42318',
        link: '/expenses',
      },
      {
        label: 'dashboard.kpi.profit',
        ...money(revenue - expenses),
        money: true,
        note: 'dashboard.kpi.profitNote',
        noteParams: { pct: revenue ? Math.round(((revenue - expenses) / revenue) * 100) : 0 },
        noteClass: revenue - expenses < 0 ? 'text-danger' : 'text-success',
        glyph: '=',
        iconBg: revenue - expenses < 0 ? '#FEECEB' : '#E6F4F2',
        iconFg: revenue - expenses < 0 ? '#B42318' : '#0B5A54',
        link: '/payments',
      },
    ];
  });

  /** Мобильная версия показывает 4 карточки: заезды и выезды объединены. */
  protected readonly mobileKpis = computed(() => {
    const k = this.kpis();
    const s = this.summary();
    return [
      k[0],
      {
        ...k[1],
        label: 'dashboard.kpi.arrivalsDepartures',
        value: s ? `${s.arrivalsToday} / ${s.departuresToday}` : '',
        note: 'dashboard.kpi.today',
        noteParams: {},
      },
      { ...k[3], note: 'dashboard.kpi.sum', noteParams: {} },
      k[4],
      // Прибыль — на всю ширину под остальными карточками.
      { ...k[5], wide: true },
    ];
  });

  protected readonly fund = computed(() => {
    const s = this.summary();
    const total = s?.totalRooms ?? 0;
    return FUND_ORDER.map((status) => {
      const count = s?.fund[status] ?? 0;
      return {
        status,
        count,
        pct: total ? (count / total) * 100 : 0,
        bar: FUND_BAR[status],
        tint: ROOM_TONE[status].bg,
        fg: ROOM_TONE[status].fg,
      };
    });
  });

  protected setMode(mode: DashboardMode): void {
    this.mode.set(mode);
  }

  protected readonly skeletonRows = [0, 1, 2, 3];
}

/** Начиная с этой суммы карточка показывает миллионы («124,5 млн»), до неё — полную сумму. */
const MLN_FROM = 100_000_000;

/**
 * Значение денежной карточки: до 100 млн — полная сумма с разделителями («13 800 000»),
 * от 100 млн — в миллионах с одним знаком после запятой («124,5 млн», «125 млн»).
 * Отрицательная сумма (убыток) — со знаком «−».
 */
function money(value: number): { value: string; mln: boolean } {
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  if (abs < MLN_FROM) {
    return { value: sign + formatSum(abs), mln: false };
  }
  const tenths = Math.round(abs / 1e5);
  const whole = formatSum(Math.floor(tenths / 10));
  const frac = tenths % 10;
  return { value: sign + whole + (frac ? `,${frac}` : ''), mln: true };
}

/** Изменение со знаком: «+6», «−3», «0». */
function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}
