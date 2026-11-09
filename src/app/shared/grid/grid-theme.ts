import {
  CellApiModule,
  CellStyleModule,
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  ColumnApiModule,
  CustomFilterModule,
  QuickFilterModule,
  LocaleModule,
  ModuleRegistry,
  PaginationModule,
  RowApiModule,
  RowAutoHeightModule,
  RowSelectionModule,
  RowStyleModule,
  TextFilterModule,
  ValidationModule,
  themeQuartz,
} from 'ag-grid-community';
import { isDevMode } from '@angular/core';

let registered = false;

/** Регистрирует только нужные модули AG Grid (экономит размер бандла). */
export function registerGridModules(): void {
  if (registered) {
    return;
  }
  registered = true;
  ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    ClientSideRowModelApiModule,
    CellApiModule,
    TextFilterModule,
    PaginationModule,
    RowSelectionModule,
    RowApiModule,
    RowAutoHeightModule,
    ColumnApiModule,
    CustomFilterModule,
    QuickFilterModule,
    LocaleModule,
    CellStyleModule,
    RowStyleModule,
    ...(isDevMode() ? [ValidationModule] : []),
  ]);
}

/** Тема AG Grid под дизайн HotelOS: строки 52px, шапка #F9FAFB, выбор строки #F0F9F7. */
export const hotelGridTheme = themeQuartz.withParams({
  fontFamily: 'inherit',
  fontSize: 14,
  foregroundColor: '#101828',
  textColor: '#101828',
  backgroundColor: '#FFFFFF',
  accentColor: '#0F766E',
  borderColor: '#EAECF0',
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  columnBorder: false,
  headerColumnBorder: false,
  rowBorder: { color: '#EAECF0' },
  headerBackgroundColor: '#F9FAFB',
  headerTextColor: '#475467',
  headerFontSize: 12,
  headerFontWeight: 600,
  headerHeight: 42,
  headerCellHoverBackgroundColor: '#F2F4F7',
  rowHeight: 52,
  rowHoverColor: '#F9FAFB',
  selectedRowBackgroundColor: '#F0F9F7',
  oddRowBackgroundColor: '#FFFFFF',
  cellHorizontalPadding: 16,
  inputHeight: 34,
  inputBorder: { color: '#D0D5DD' },
  inputFocusBorder: { color: '#0F766E' },
  inputPlaceholderTextColor: '#667085',
  checkboxCheckedBackgroundColor: '#0F766E',
  checkboxUncheckedBorderColor: '#98A2B3',
  iconSize: 14,
  rowLoadingSkeletonEffectColor: '#EEF0F3',
  spacing: 6,
});
