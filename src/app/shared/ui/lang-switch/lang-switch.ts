import { Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LANGS, LanguageService } from '../../../core/i18n/language.service';

/** Переключатель языка RU / O‘Z / ЎЗ. Варианты: compact (шапка), large (вход), segmented (мобильное «Ещё»). */
@Component({
  selector: 'app-lang-switch',
  imports: [TranslocoPipe],
  template: `
    <div
      role="group"
      [attr.aria-label]="'common.language' | transloco"
      [class]="
        variant() === 'segmented'
          ? 'grid grid-cols-3 gap-0.5 rounded-[10px] bg-line-2 p-[3px]'
          : 'flex gap-0.5 rounded-lg border border-line bg-white p-[3px]'
      "
    >
      @for (l of langs; track l.code) {
        <button
          type="button"
          class="cursor-pointer rounded-md border-0 font-semibold transition-colors"
          [class]="sizeClass() + ' ' + stateClass(l.code === lang.current())"
          [attr.aria-pressed]="l.code === lang.current()"
          [attr.lang]="l.code"
          (click)="lang.use(l.code)"
        >
          {{ l.short }}
        </button>
      }
    </div>
  `,
})
export class LangSwitch {
  readonly variant = input<'compact' | 'large' | 'segmented'>('compact');

  protected readonly lang = inject(LanguageService);
  protected readonly langs = LANGS;

  protected sizeClass(): string {
    switch (this.variant()) {
      case 'large':
        return 'min-h-10 min-w-[52px] text-[13px]';
      case 'segmented':
        return 'min-h-10 text-sm rounded-lg';
      default:
        return 'min-h-8 min-w-[42px] text-xs';
    }
  }

  protected stateClass(active: boolean): string {
    if (this.variant() === 'segmented') {
      return active
        ? 'bg-white text-ink shadow-[0_1px_2px_rgba(16,24,40,.12)]'
        : 'bg-transparent text-muted hover:text-ink';
    }
    return active ? 'bg-accent-soft text-accent-dark' : 'bg-transparent text-ink-2 hover:bg-chip';
  }
}
