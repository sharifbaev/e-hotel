import { Component, input } from '@angular/core';
import { FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { InputText } from 'primeng/inputtext';
import { HotelDraft } from '../../core/models';
import { PhoneInputDirective } from '../../shared/forms/phone-input.directive';

/** Форма реквизитов отеля (HotelDraft): название, город, юр. лицо, ИНН, телефон, адрес. */
export function hotelGroup(fb: NonNullableFormBuilder) {
  return fb.group({
    name: ['', Validators.required],
    city: ['', Validators.required],
    legalName: [''],
    inn: ['', Validators.pattern(/^(\d{9})?$/)],
    phone: [''],
    address: [''],
  });
}

export type HotelGroup = ReturnType<typeof hotelGroup>;

export function hotelDraft(g: HotelGroup): HotelDraft {
  const v = g.getRawValue();
  return {
    name: v.name.trim(),
    city: v.city.trim(),
    legalName: v.legalName.trim(),
    inn: v.inn.trim(),
    phone: v.phone.trim(),
    address: v.address.trim(),
  };
}

/** Поля реквизитов отеля (используются в «Новый владелец», «Добавить отель», «Реквизиты»). */
@Component({
  selector: 'app-hotel-fields',
  imports: [ReactiveFormsModule, TranslocoPipe, InputText, PhoneInputDirective],
  template: `
    <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1" [formGroup]="group()">
      <div class="field">
        <label [for]="prefix() + '-name'" class="field-label"
          >{{ 'platform.hotel.name' | transloco }} <span class="req">*</span></label
        >
        <input
          [id]="prefix() + '-name'"
          pInputText
          formControlName="name"
          placeholder="Grand Hotel"
          [invalid]="bad('name')"
          [attr.aria-invalid]="bad('name')"
        />
      </div>
      <div class="field">
        <label [for]="prefix() + '-city'" class="field-label"
          >{{ 'platform.hotel.city' | transloco }} <span class="req">*</span></label
        >
        <input
          [id]="prefix() + '-city'"
          pInputText
          formControlName="city"
          [invalid]="bad('city')"
          [attr.aria-invalid]="bad('city')"
        />
      </div>
      <div class="field">
        <label [for]="prefix() + '-legal'" class="field-label">{{
          'platform.hotel.legalName' | transloco
        }}</label>
        <input [id]="prefix() + '-legal'" pInputText formControlName="legalName" />
      </div>
      <div class="field">
        <label [for]="prefix() + '-inn'" class="field-label">{{
          'platform.hotel.inn' | transloco
        }}</label>
        <input
          [id]="prefix() + '-inn'"
          pInputText
          maxlength="9"
          inputmode="numeric"
          formControlName="inn"
          [invalid]="bad('inn') || innError()"
          [attr.aria-invalid]="bad('inn') || innError()"
        />
        <span class="hint" [class.text-danger]="bad('inn') || innError()">{{
          'platform.hotel.innHint' | transloco
        }}</span>
      </div>
      <div class="field">
        <label [for]="prefix() + '-phone'" class="field-label">{{
          'platform.hotel.phone' | transloco
        }}</label>
        <input [id]="prefix() + '-phone'" pInputText appPhone formControlName="phone" />
      </div>
      <div class="field">
        <label [for]="prefix() + '-address'" class="field-label">{{
          'platform.hotel.address' | transloco
        }}</label>
        <input [id]="prefix() + '-address'" pInputText formControlName="address" />
      </div>
    </div>
  `,
})
export class HotelFields {
  readonly group = input.required<FormGroup>();
  readonly tried = input(false);
  /** Префикс id полей (на странице может быть несколько форм). */
  readonly prefix = input('h');
  /** 422 settings.innInvalid с сервера. */
  readonly innError = input(false);

  protected bad(name: string): boolean {
    return this.tried() && !!this.group().get(name)?.invalid;
  }
}
