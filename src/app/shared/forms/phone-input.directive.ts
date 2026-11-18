import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { keepCaretAfterPrefix, wouldEditPrefix } from './prefix-caret';

/** Код Узбекистана — неизменяемое начало поля. */
const PREFIX = '+998 ';
const MAX_DIGITS = 9;

/** 901234567 → «90 123 45 67». */
function group(digits: string): string {
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)]
    .filter(Boolean)
    .join(' ');
}

/** Цифры номера без кода страны (не больше 9). */
function localDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length > MAX_DIGITS && digits.startsWith('998')) {
    digits = digits.slice(3);
  }
  return digits.slice(0, MAX_DIGITS);
}

/**
 * Телефон: «+998 » — часть поля, его нельзя стереть; дальше только цифры
 * с группировкой «90 123 45 67». В модель формы — «+998901234567» или "" (номер не введён).
 */
@Directive({
  selector: 'input[appPhone]',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhoneInputDirective), multi: true },
  ],
  host: {
    type: 'tel',
    inputmode: 'tel',
    autocomplete: 'tel',
    '(input)': 'onInput()',
    '(keydown)': 'onKeydown($event)',
    '(focus)': 'onCaret()',
    '(click)': 'onCaret()',
    '(keyup)': 'onCaret()',
    '(blur)': 'onTouched()',
  },
})
export class PhoneInputDirective implements ControlValueAccessor {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private digits = '';
  private onChange: (v: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  constructor() {
    this.render();
  }

  writeValue(value: string | null): void {
    const raw = value ?? '';
    this.digits = localDigits(raw.startsWith('+998') ? raw.slice(4) : raw);
    this.render();
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.el.nativeElement.disabled = disabled;
  }

  protected onInput(): void {
    const value = this.el.nativeElement.value;
    // Префикс повреждён (выделили и стёрли вместе с ним) — оставляем прежние цифры.
    if (value.startsWith('+998')) {
      this.digits = localDigits(value.slice(4));
    }
    this.render();
    this.onChange(this.digits ? `+998${this.digits}` : '');
  }

  protected onKeydown(e: KeyboardEvent): void {
    const input = this.el.nativeElement;
    if (e.key === 'Home') {
      e.preventDefault();
      input.setSelectionRange(
        PREFIX.length,
        e.shiftKey ? (input.selectionEnd ?? 0) : PREFIX.length,
      );
    } else if (wouldEditPrefix(e, input, PREFIX.length)) {
      e.preventDefault();
    }
  }

  protected onCaret(): void {
    keepCaretAfterPrefix(this.el.nativeElement, PREFIX.length);
  }

  private render(): void {
    this.el.nativeElement.value = PREFIX + group(this.digits);
  }
}
