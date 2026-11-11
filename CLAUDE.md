# HotelOS (e-hotel)

Веб-приложение для управления отелями и хостелами на рынке Узбекистана / Центральной Азии.

## Модули
- Аутентификация и роли (RBAC): системные роли владелец, администратор, бухгалтер + роли, созданные в «Настройки → Справочники»
- Номерной фонд: номера, категории, статусы (свободен / занят / уборка / ремонт)
- Бронирования и шахматка (календарь занятости)
- Гости: карточка гостя, регистрация гостей по требованиям законодательства РУз
- Оплаты и фискализация (онлайн-ККМ)
- Дашборды: выручка, загрузка, ADR, RevPAR

## Стек
- Angular 22, standalone-компоненты, signals, новый control flow (@if, @for)
- Стили: SCSS + Tailwind CSS
- UI: PrimeNG (тема через дизайн-токены, интеграция с Tailwind через tailwindcss-primeui)
- Таблицы: AG Grid
- Графики: ApexCharts (ng-apexcharts)
- i18n: Transloco — языки ru, uz-Latn, uz-Cyrl
- Backend: REST API `/api/v1` (Spring, Swagger: https://3-26-35-169.sslip.io/swagger-ui/index.html); в dev `/api/v1` проксируется туда (`proxy.conf.json`)

## Правила работы
- Отвечай на русском
- Минимальные изменения: не переписывай существующую логику без запроса
- Выдавай полные готовые файлы
- Большие задачи делай по одному шагу и жди подтверждения
- Все тексты в UI — через Transloco, без хардкода

## Структура (подключено к API, 08.11.2026)
- `src/app/core` — модели (`models`), сервисы данных (`data/*.service.ts`, HttpClient → `API_URL` из `api/api.ts`), auth (JWT: `auth.service.ts` + `api/api.interceptors.ts` — токен, обновление на 401, ошибки → `ApiError` с кодом сервера для `errors.<code>`), i18n, тема PrimeNG (`theme/hotelos-preset.ts`)
- Всё подключено к API, включая дополнение v1.1 (`docs/`, 09.11.2026): «Доп. сервисы» (`/extra-services`), «Долги» (`/debts`), дата-время с секундами у расходов, `/staff?includeInactive=true` (формы — `StaffService.names()`, только активные; фильтры — `allNames()`, все). `mocks/mock-data.ts` больше не используется сервисами, кроме справочника `MOCK_COUNTRIES`
- `src/app/shared` — иконки, бейджи статусов, таблица на AG Grid (`grid/data-grid.ts`), попап результата, шторка, форматирование
- `src/app/features/*` — экраны; мобильная версия (< 768px) в тех же компонентах через `BreakpointService.isMobile()`
- Словари: `public/i18n/{ru,uz-Latn,uz-Cyrl}.json`
- «Сегодня» — токен `APP_TODAY` (дата на компьютере)
- Вход — реальные учётные записи сервера (POST /auth/login); после сброса пароля — окно обязательной смены (`shared/ui/change-password`)
- Ключ лицензии PrimeUI — `src/app/core/theme/primeui-license.ts`
- Доступ к меню (10.11.2026, API v1.2 — `docs/*v1.2-qoshimcha*`): разделы `AppSection` (models); `AuthService.sections()/can()/homePath()` — из `CurrentUser.sections`, иначе `DEFAULT_ROLE_SECTIONS`; маршруты — `sectionGuard(...)`, меню фильтруется по разделам. Роли — `RolesService` (`/roles`, без API — 3 системные), подпись — пайп `roleLabel`. Виды доп. сервисов — справочник `/service-types` (`ServiceTypesService`), в форме + «Другое» (serviceTypeId = null). Удаление номера — `DELETE /rooms/{number}`
- Комментарии гостей и QR-коды — тоже REST API (`/comments`, `/qr`). Локальный `server/hotel-api.mjs` (`npm run api`) нужен только для `/api/lan` — Wi-Fi адресов ноутбука в QR-ссылке, когда сайт открыт как localhost (`npm run start:lan`). Страница гостя по QR — публичный маршрут `/c/:room`

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.


## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

## Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection
