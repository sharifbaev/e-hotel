import { Directive, ElementRef, forwardRef, inject, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Поле для целого числа: принимает только цифры (буквы, пробелы, знаки отбрасываются
 * прямо при вводе и вставке). В модель формы уходит число или null.
 * `[appDigits]="2"` — максимальное количество цифр.
 */
@Directive({
  selector: 'input[appDigits]',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DigitsInputDirective), multi: true },
  ],
  host: {
    inputmode: 'numeric',
    autocomplete: 'off',
    '(input)': 'onInput()',
    '(blur)': 'onTouched()',
  },
})
export class DigitsInputDirective implements ControlValueAccessor {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  /** Максимум цифр (по умолчанию 3). */
  readonly appDigits = input<number | string | undefined>(3);
  private onChange: (v: number | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: number | null): void {
    this.el.nativeElement.value = value === null || value === undefined ? '' : String(value);
  }

  registerOnChange(fn: (v: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.el.nativeElement.disabled = disabled;
  }

  protected onInput(): void {
    const input = this.el.nativeElement;
    const max = Number(this.appDigits()) || 3;
    const digits = input.value.replace(/\D+/g, '').slice(0, max);
    input.value = digits;
    this.onChange(digits ? Number(digits) : null);
  }
}
