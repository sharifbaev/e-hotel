import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexPlotOptions,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  ChartComponent,
} from 'ng-apexcharts';
import { DailyFinance, DashboardMode } from '../../core/models';
import { LanguageService } from '../../core/i18n/language.service';
import { dayAndMonth, weekdayIndex } from '../../shared/format/format';

const REVENUE_COLOR = '#0F766E';
const EXPENSE_COLOR = '#E8A54B';

/** Столбики «Выручка / Расходы» по дням (млн сум). */
@Component({
  selector: 'app-finance-chart',
  imports: [ChartComponent],
  template: `
    <div class="absolute inset-0" role="img" [attr.aria-label]="ariaLabel()">
      <apx-chart
        [chart]="chart()"
        [series]="series()"
        [colors]="colors"
        [plotOptions]="plotOptions()"
        [dataLabels]="dataLabels()"
        [xaxis]="xaxis()"
        [yaxis]="yaxis"
        [grid]="grid"
        [legend]="legend"
        [tooltip]="tooltip()"
      />
    </div>
  `,
  host: { class: 'relative block min-h-0', '[style.height.px]': 'height()' },
})
export class FinanceChart {
  readonly data = input.required<DailyFinance[]>();
  readonly mode = input<DashboardMode>('week');
  /** Фиксированная высота (px). Если не задана — график занимает высоту контейнера. */
  readonly height = input<number | null>(null);
  readonly compact = input(false);

  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService);

  protected readonly colors = [REVENUE_COLOR, EXPENSE_COLOR];

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Высота контейнера: ApexCharts не умеет «100%» во flex-раскладке. */
  private readonly hostHeight = signal(220);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      this.hostHeight.set(Math.max(140, Math.floor(el.clientHeight)));
      const ro = new ResizeObserver(([entry]) => {
        const h = Math.max(140, Math.floor(entry.contentRect.height));
        if (Math.abs(h - this.hostHeight()) > 4) {
          this.hostHeight.set(h);
        }
      });
      ro.observe(el);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  private readonly many = computed(() => this.data().length > 14);

  private readonly t = computed(() => {
    this.lang.current();
    return (key: string, params?: Record<string, unknown>) => this.transloco.translate(key, params);
  });

  protected readonly chart = computed<ApexChart>(() => ({
    type: 'bar',
    height: this.height() ?? this.hostHeight(),
    fontFamily: 'Inter, system-ui, sans-serif',
    toolbar: { show: false },
    zoom: { enabled: false },
    parentHeightOffset: 0,
    animations: { enabled: true, speed: 450 },
  }));

  protected readonly series = computed<ApexAxisChartSeries>(() => {
    const t = this.t();
    return [
      { name: t('dashboard.revenue'), data: this.data().map((d) => round1(d.revenue / 1e6)) },
      { name: t('dashboard.expenses'), data: this.data().map((d) => round1(d.expenses / 1e6)) },
    ];
  });

  protected readonly plotOptions = computed<ApexPlotOptions>(() => ({
    bar: {
      columnWidth: this.many() ? '78%' : this.compact() ? '60%' : '52%',
      borderRadius: this.many() ? 2 : 4,
      borderRadiusApplication: 'end',
      dataLabels: { position: 'top' },
    },
  }));

  protected readonly dataLabels = computed<ApexDataLabels>(() => ({
    enabled: !this.many() && !this.compact(),
    enabledOnSeries: [0],
    offsetY: -16,
    style: { fontSize: '10px', fontWeight: 500, colors: ['#475467'] },
    formatter: (v: number) => fmt(v),
  }));

  protected readonly xaxis = computed<ApexXAxis>(() => {
    const t = this.t();
    const many = this.many();
    const week = this.mode() === 'week';
    return {
      categories: this.data().map((d, i) => {
        const { day } = dayAndMonth(d.date);
        if (many) {
          return day % 5 === 0 || i === 0 ? String(day) : '';
        }
        return week ? `${t('weekdays.short.' + weekdayIndex(d.date))} ${day}` : String(day);
      }),
      labels: {
        rotate: 0,
        hideOverlappingLabels: false,
        style: { colors: '#475467', fontSize: this.compact() ? '10px' : '11px' },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    };
  });

  protected readonly yaxis: ApexYAxis = { show: false };

  protected readonly grid: ApexGrid = {
    show: false,
    padding: { left: 0, right: 0, top: 0, bottom: 0 },
  };

  protected readonly legend: ApexLegend = { show: false };

  protected readonly tooltip = computed<ApexTooltip>(() => {
    const t = this.t();
    return {
      shared: true,
      intersect: false,
      x: {
        formatter: (_v: number, opts?: { dataPointIndex: number }) => {
          const d = this.data()[opts?.dataPointIndex ?? 0];
          if (!d) {
            return '';
          }
          const { day, month } = dayAndMonth(d.date);
          return `${day} ${t('months.short.' + month)}`;
        },
      },
      y: { formatter: (v: number) => t('dashboard.millionSum', { value: fmt(v) }) },
    };
  });

  protected readonly ariaLabel = computed(() => {
    const t = this.t();
    const rev = this.data().reduce((s, d) => s + d.revenue, 0) / 1e6;
    const exp = this.data().reduce((s, d) => s + d.expenses, 0) / 1e6;
    return t('dashboard.chartAria', { revenue: fmt(rev), expenses: fmt(exp) });
  });
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function fmt(v: number): string {
  return round1(v).toFixed(1).replace('.', ',');
}
