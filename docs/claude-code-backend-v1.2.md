# HotelOS (e-hotel) backend — v1.2 vazifasi (Claude Code uchun)

> Bu fayl Claude Code uchun topshiriq. Uni backend loyihasining ildiziga qo‘ying va Claude Code ga ayting:
> **«docs/claude-code-backend-v1.2.md faylidagi vazifani bajar»**.
> Batafsil tushuntirish (jadvallar bilan) — `hotelos-api-v1.2-qoshimcha.pdf`. Ikkalasida shartnoma bir xil; farq bo‘lsa — shu fayl asosiy.

## 0. Ish qoidalari

- Javoblarni **o‘zbek tilida (lotin)** yoz.
- Avval loyihani o‘rgan: Spring Boot versiyasi, paketlar tuzilishi, entity/repository/service/controller uslubi, migratsiya vositasi (Flyway yoki Liquibase), xatolar formati (`{ "error": { "code", "message", "fields" } }`), xavfsizlik (JWT filtri, ruxsat tekshiruvi qayerda). **Mavjud uslubga moslash**, yangi kutubxona qo‘shma.
- Mavjud ishlayotgan yo‘llarni buzma. Faqat quyida yozilganlarni o‘zgartir.
- Har bir bosqichdan keyin: `./mvnw test` (yoki `./gradlew test`) va ilova ishga tushishini tekshir. Bosqich tugagach, qisqa hisobot ber va keyingisiga o‘t.
- Ma’lumotlar bazasi o‘zgarishlari — **faqat migratsiya orqali** (yangi versiyali fayl), mavjud migratsiyalarni tahrirlama.
- Oxirida Swagger (`/v3/api-docs`) da yangi yo‘llar va sxemalar ko‘rinishini tekshir.

## 1. Umumiy ma’lumot

Frontend (Angular) allaqachon tayyor va quyidagilarni chaqiradi. API prefiksi: `/api/v1`. Barcha vaqtlar `YYYY-MM-DDTHH:mm:ss` (v1.1 dagidek).

O‘zgarishlar:
1. Faqat 3 ta **tizim roli**: `owner` (egasi), `admin` (administrator), `accountant` (buxgalter). `reception`, `housekeeper` olib tashlanadi.
2. **Rollar CRUD** (`/roles`): egasi yangi rol yaratadi va menyu bo‘limlarini belgilaydi.
3. **Bo‘limlar bo‘yicha kirish**: har bir so‘rovda foydalanuvchi rolining bo‘limlari tekshiriladi; login va `/auth/me` `roleName` va `sections` qaytaradi.
4. **Qo‘shimcha xizmat turlari ma’lumotnomasi** (`/service-types`); `/extra-services` da `serviceType` (enum) o‘rniga `serviceTypeId` + `serviceTypeName`.
5. **Xonani o‘chirish**: `DELETE /rooms/{number}`.

## 2. Menyu bo‘limlari (AppSection)

```
dashboard | rooms | book | guests | blacklist | payments | comments | users | settings
```

Tizim rollari uchun standart bo‘limlar (seed):

| Rol | sections |
|---|---|
| owner | hammasi (doim, o‘zgarmaydi) |
| admin | rooms, book, guests, payments, comments |
| accountant | dashboard, payments |

## 3-bosqich. Rollar: ma’lumotlar bazasi va migratsiya

Jadval (nomlarni loyiha uslubiga moslang):

```
roles
  id        bigint PK
  code      varchar(40)  UNIQUE NOT NULL   -- owner | admin | accountant | role_<id>
  name      varchar(80)  NOT NULL          -- unikal, katta-kichik harfsiz
  system    boolean      NOT NULL DEFAULT false
  sections  -- jsonb / text[] / alohida role_sections(role_id, section) jadvali
```

Migratsiya:
- 3 ta tizim rolini qo‘sh: `owner` «Egasi», `admin` «Administrator», `accountant` «Buxgalter», `system = true`, sections — 2-bo‘limdagi jadval.
- `reception` va `housekeeper` roldagi barcha foydalanuvchilarni `admin` ga o‘tkaz.
- Foydalanuvchining roli `roles` ga bog‘lansin (`users.role` → `roles.code` FK yoki `role_id`). API da baribir **code** (string) qaytadi.
- `RoleCode` enum ni olib tashla: `StaffUser`, `StaffUserDraft`, `CurrentUser`, `StaffShort` (`GET /staff`) dagi `role` — oddiy `string`.

## 4-bosqich. `/roles` CRUD

```json
// Role
{ "id": 4, "code": "role_4", "name": "Qabulxona", "system": false, "sections": ["rooms", "book", "guests"] }
// RoleDraft (POST/PUT tanasi)
{ "name": "Qabulxona", "sections": ["rooms", "book", "guests"] }
```

| So‘rov | Kirish | Qoidalar | Javob |
|---|---|---|---|
| `GET /roles` | har qanday kirgan foydalanuvchi | Avval tizim rollari (owner, admin, accountant), keyin qolganlari id bo‘yicha. `owner.sections` — doim barcha bo‘limlar | 200 `Role[]` |
| `POST /roles` | `settings` | `name` trim, bo‘sh emas, unikal (katta-kichik harfsiz) → 409 `roles.exists`. `sections` kamida 1 ta, faqat AppSection, dublikatsiz → aks holda 422 `validation.failed`. `code` ni server beradi (`role_<id>`), `system = false` | 201 `Role` |
| `PUT /roles/{id}` | `settings` | Oddiy rol: `name` + `sections`. `admin`/`accountant`: faqat `sections` (name e’tiborsiz). `owner` → 409 `roles.system`. Yo‘q → 404 `roles.notFound` | 200 `Role` |
| `DELETE /roles/{id}` | `settings` | Tizim roli → 409 `roles.system`. Rolda xodim bor (bloklanganlar ham) → 409 `roles.inUse` | 204 |

`POST/PUT /users`: `role` mavjud rol code i bo‘lishi shart, aks holda 422 `validation.failed`, `fields.role`.

`GET /roles/permissions` — front endi ishlatmaydi; qoldirsa bo‘ladi.

## 5-bosqich. CurrentUser va StaffUser

`POST /auth/login` javobidagi `user`, `GET /auth/me` — ikki yangi maydon:

```json
{
  "id": 1, "name": "Aziz Sharifboyev", "login": "admin1", "role": "admin",
  "roleName": "Administrator",
  "sections": ["rooms", "book", "guests", "payments", "comments"],
  "hotelName": "...", "hotelCity": "...", "mustChangePassword": false
}
```

`StaffUser` (`GET /users` va h.k.) ga `roleName` qo‘sh.

## 6-bosqich. Bo‘limlar bo‘yicha kirishni tekshirish

Eski «level 0/1/2» tekshiruvi o‘rniga: foydalanuvchi rolida kerakli bo‘limlardan **kamida bittasi** bo‘lsa — ruxsat, aks holda `403 auth.forbidden`. Ruxsat tokendan emas, **bazadagi joriy rol** bo‘yicha (rol o‘zgarsa darhol ta’sir qilsin; keshlansa — qisqa muddat). Iloji bo‘lsa, bitta joyda (masalan, annotatsiya `@RequiresSection({"rooms","book"})` + interceptor/aspect yoki `SecurityFilterChain` qoidalari) qil.

| Yo‘l | Kerakli bo‘lim (istalgan biri) |
|---|---|
| `/auth/*`, `GET /staff`, `GET /roles` | kirgan har qanday foydalanuvchi |
| `GET /dashboard` | dashboard |
| `GET /rooms`, `GET /rooms/available`, `GET /categories` | rooms, book, settings |
| `POST/PUT/DELETE /rooms…`, `/rooms/{n}/ready`, `/rooms/{n}/status`, `/rooms/{n}/extend` | rooms |
| `POST /rooms/{n}/checkout` | rooms, book |
| `/book`, `/book/{id}` | book, rooms |
| `GET /guests/lookup`, `GET /blacklist/check` | rooms, book |
| `GET /guests/archive` | guests |
| `GET /blacklist`, `DELETE /blacklist/{id}` | blacklist |
| `POST /blacklist` | blacklist, rooms, book |
| `POST /fiscal/receipts` | rooms, book, guests |
| `/expenses*`, `/extra-services*`, `/debts*` | payments |
| `GET /expenses/recent` | payments, dashboard |
| `GET /service-types` | payments, settings |
| `POST/PUT/DELETE /service-types`, `POST/PUT/DELETE /roles`, `POST/PUT/DELETE /categories`, `/settings/hotel`, `/audit-log*` | settings |
| `/users*`, `/roles/permissions` | users |
| `GET/PATCH/DELETE /comments`, `POST /comments/read-all` | comments |
| `POST /comments` | ommaviy (o‘zgarmaydi) |
| `GET /qr`, `GET /qr/{room}` | rooms, comments |
| `PUT /qr/{room}` | rooms |

Testlar: admin `GET /dashboard` → 403; accountant `GET /rooms` → 403; accountant `GET /extra-services` → 200; owner hammasi → 200; yangi rol (`sections: ["book"]`) `GET /book` → 200, `GET /guests/archive` → 403.

## 7-bosqich. Qo‘shimcha xizmat turlari

```
service_types
  id    bigint PK
  name  varchar(80) NOT NULL   -- unikal, katta-kichik harfsiz

extra_services
  + service_type_id    bigint NULL  → service_types.id  ON DELETE SET NULL
  + service_type_name  varchar(80) NOT NULL DEFAULT ''  -- yozish paytidagi nom (snapshot)
  - service_type (enum)  -- ma’lumot ko‘chirilgandan keyin o‘chiriladi
```

Migratsiya: seed «Nonushta», «Basseyn va sauna», «Fotosessiya». Eski yozuvlar: `breakfast` → «Nonushta», `pool_sauna` → «Basseyn va sauna», `photo` → «Fotosessiya» (id va name to‘ldirilsin); `other` → `service_type_id = null`, `service_type_name = ''`, `reason` o‘zgarmaydi.

```json
// ServiceTypeItem
{ "id": 1, "name": "Nonushta" }
// ServiceTypeDraft
{ "name": "Transfer" }
```

| So‘rov | Kirish | Qoidalar | Javob |
|---|---|---|---|
| `GET /service-types` | payments, settings | Nom bo‘yicha alifbo tartibida. «Boshqa» ro‘yxatda YO‘Q (front o‘zi qo‘shadi) | 200 `ServiceTypeItem[]` |
| `POST /service-types` | settings | name trim, bo‘sh emas, unikal → 409 `serviceTypes.exists` | 201 |
| `PUT /service-types/{id}` | settings | Eski `extra_services.service_type_name` **o‘zgarmaydi**. Yo‘q → 404 `serviceTypes.notFound` | 200 |
| `DELETE /service-types/{id}` | settings | Ishlatilgan bo‘lsa ham o‘chadi (FK → null, nom saqlanadi) | 204 |

`/extra-services` (GET/POST/PUT) o‘zgarishi:

```json
// ExtraServiceDraft
{ "serviceTypeId": 2, "reason": "", "sum": 500000, "date": "2026-11-10T14:05:09", "who": "Sherzod Nazarov" }
// «Boshqa»:
{ "serviceTypeId": null, "reason": "Aeroportdan transfer", "sum": 350000, "date": "...", "who": "..." }
// ExtraService (javob)
{ "id": 7, "serviceTypeId": 2, "serviceTypeName": "Basseyn va sauna", "reason": "", "sum": 500000, "date": "2026-11-10T14:05:09", "who": "Sherzod Nazarov" }
```

- `serviceTypeId` son → `/service-types` da bo‘lishi shart (aks holda 422, `fields.serviceTypeId`); server `serviceTypeName` ni shu turdan yozadi, `reason = ""`.
- `serviceTypeId = null` → `reason` majburiy (trim dan keyin bo‘sh emas); `serviceTypeName = ""`.
- `serviceType` (eski enum) maydoni javobdan olib tashlanadi.

## 8-bosqich. `DELETE /rooms/{number}`

- Kirish: `rooms`. Javob: 204.
- Xonada yashovchi mehmon bor (`status = busy` yoki guests bo‘sh emas) → 409 `rooms.hasGuests`. Topilmadi → 404 `rooms.notFound`.
- Xonaning QR holati ham o‘chiriladi. Arxiv, kitob tarixi, izohlar, cheklar **o‘chirilmaydi** (xona raqami u yerda matn sifatida qoladi; FK bo‘lsa — buni hisobga ol).
- `GET /categories` dagi `rooms` soni kamayadi.

## 9. Yangi xato kodlari

| HTTP | code |
|---|---|
| 409 | `roles.exists`, `roles.system`, `roles.inUse` |
| 404 | `roles.notFound` |
| 409 | `serviceTypes.exists` |
| 404 | `serviceTypes.notFound` |
| 409 | `rooms.hasGuests` (v1.0 da bor edi) |
| 404 | `rooms.notFound` |
| 403 | `auth.forbidden` |

## 10. Yakuniy tekshiruv (oxirida hisobot ber)

- [ ] Migratsiyalar toza bazada ham, mavjud bazada ham o‘tadi.
- [ ] `roles` + seed; reception/housekeeper → admin.
- [ ] `/roles` CRUD + 409/404 kodlari.
- [ ] Login va `/auth/me` da `roleName`, `sections`; `StaffUser.roleName`.
- [ ] 6-bosqichdagi jadval bo‘yicha 403 tekshiruvi + testlar.
- [ ] `service_types` + seed + `extra_services` migratsiyasi; `/service-types` CRUD; `/extra-services` yangi format.
- [ ] `DELETE /rooms/{number}`.
- [ ] Barcha testlar o‘tadi; Swagger yangilangan.
- [ ] Hisobot: nima qilindi, qaysi fayllar o‘zgardi, migratsiya nomlari, frontga ta’sir qiladigan farqlar (agar shartnomadan chetga chiqilgan bo‘lsa — sababi bilan).
