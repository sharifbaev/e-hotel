import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { formatSumInput, parseSum } from '../format/format';

/**
 * Поле суммы в сумах: принимает только цифры и группирует разряды пробелами
 * («4 100 000»). В модель формы уходит число или null.
 */
@Directive({
  selector: 'input[appSum]',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SumInputDirective), multi: true },
  ],
  host: {
    inputmode: 'numeric',
    autocomplete: 'off',
    '(input)': 'onInput()',
    '(blur)': 'onTouched()',
  },
})
export class SumInputDirective implements ControlValueAccessor {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private onChange: (v: number | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: number | null): void {
    this.el.nativeElement.value = value ? formatSumInput(String(value)) : '';
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
    const formatted = formatSumInput(input.value);
    input.value = formatted;
    this.onChange(formatted ? parseSum(formatted) : null);
  }
}
