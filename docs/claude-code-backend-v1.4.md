# HotelOS (e-hotel) backend — v1.4 vazifasi (Claude Code uchun)

> Bu fayl Claude Code uchun topshiriq. Uni backend loyihasining `docs/` papkasiga qo‘ying va Claude Code ga ayting:
> **«docs/claude-code-backend-v1.4.md faylidagi vazifani bajar»**.
> Batafsil tushuntirish (jadvallar bilan) — `hotelos-api-v1.4-qoshimcha.pdf`, sxemalar — `openapi-v1.4-qoshimcha.yaml`. Uchalasida shartnoma bir xil; farq bo‘lsa — shu fayl asosiy.
> v1.4 — v1.3 ustiga qo‘shiladi (v1.3 dagi `/payment-types`, jurnal kodlari `<bo‘lim>.<amal>`, chiqarishdagi `payment`/`paidCard`/`paidCash` allaqachon bor deb hisoblanadi).

## 0. Ish qoidalari

- Javoblarni **o‘zbek tilida (lotin)** yoz.
- Avval loyihani o‘rgan: paketlar tuzilishi, entity/repository/service/controller uslubi, migratsiya vositasi (Flyway yoki Liquibase), xatolar formati (`{ "error": { "code", "message", "fields" } }`), xavfsizlik (JWT, bo‘lim ruxsatlari), jurnalga yozish qayerda. **Mavjud uslubga moslash**, yangi kutubxona qo‘shma.
- Mavjud ishlayotgan yo‘llarni buzma. Faqat quyida yozilganlarni o‘zgartir.
- Ma’lumotlar bazasi o‘zgarishlari — **faqat yangi migratsiya** orqali; mavjud migratsiyalarni tahrirlama.
- Har bir bosqichdan keyin: testlar (`./mvnw test` yoki `./gradlew test`) va ilova ishga tushishini tekshir, qisqa hisobot ber va keyingisiga o‘t.
- Oxirida Swagger (`/v3/api-docs`) da yangi maydonlar va yo‘llar ko‘rinishini tekshir.

## 1. Umumiy ma’lumot

API prefiksi: `/api/v1`. Vaqtlar `YYYY-MM-DDTHH:mm:ss`. Summalar — butun son (so‘m).

| # | O‘zgarish | Yo‘llar |
|---|---|---|
| 1 | Joylashtirishdagi `amount` endi **kunlik narx** (bir sutka). Maydon nomi o‘zgarmaydi | `POST/PUT/GET /book` |
| 2 | Mehmonga **oldindan to‘lov** (`prepayment`) qo‘shiladi; `payment` — oldindan to‘lov usuli | `POST/PUT/GET /book` |
| 3 | «Kitob»dan oldindan to‘lov kiritish (yig‘iladi) | **YANGI** `POST /book/{id}/prepayments` |
| 4 | Xonadagi mehmonda `prepayment` | `GET /rooms` |
| 5 | Chiqarish: to‘lanishi kerak, oldindan to‘lov, to‘langan, qarz | `POST /rooms/{number}/checkout` |
| 6 | Qarzni to‘lash: to‘liq — qarz o‘chadi, qisman — qoldiq | **YANGI** `POST /debts/{id}/payments` |
| 7 | Hammasi harakatlar jurnaliga | `GET /audit-log` |

Hisoblash qoidasi (chiqarishda):

```
to‘lanishi kerak (amount) = Σ (kunlik narx × kunlar)      — kunlar = sanalar farqi, kamida 1
qarz (debt)               = max(0, amount − prepayment − paid)
```

## 2-bosqich. Ma’lumotlar bazasi (bitta yangi migratsiya)

`book` (kitob yozuvi / joylashgan mehmon):

| Ustun | Tur | Izoh |
|---|---|---|
| `prepayment` | bigint not null default 0 | Jami kiritilgan oldindan to‘lov |

Yangi jadval `book_prepayments` — har bir kiritish tarixi:

| Ustun | Tur |
|---|---|
| `id` | bigserial PK |
| `book_id` | bigint, FK → book, `on delete set null` (mehmon arxivga o‘tsa ham tarix qoladi) |
| `guest_doc` | varchar — hujjat (book o‘chgandan keyin ham bog‘lash uchun) |
| `amount` | bigint, > 0 |
| `payment` | varchar — to‘lov usuli kodi |
| `created_at` | timestamp |
| `created_by` | xodim (loyihadagi uslubda: id yoki F.I.Sh.) |

Arxiv (`guests` arxivi) jadvaliga: `prepayment bigint not null default 0`, `paid bigint null`, `debt bigint not null default 0`.

Yangi jadval `debt_payments`:

| Ustun | Tur |
|---|---|
| `id` | bigserial PK |
| `debt_id` | bigint, FK → debts, `on delete set null` |
| `debtor` | varchar (qarz o‘chgandan keyin ham ko‘rinsin) |
| `amount` | bigint, > 0 |
| `payment` | varchar |
| `created_at` | timestamp |
| `created_by` | xodim |

Mavjud yozuvlar: `prepayment = 0`, `debt = 0`.

## 3-bosqich. `GuestRegistration` — `POST /book`, `PUT /book/{id}`, `GET /book`

`reg` ichida:

```json
{
  "...": "...",
  "amount": 300000,
  "prepayment": 200000,
  "payment": "cash",
  "fiscalReceipt": false
}
```

- `amount` — **kunlik narx**, majburiy, > 0.
- `prepayment` — ixtiyoriy; yo‘q yoki `null` → 0; manfiy bo‘lmaydi (aks holda 422, `fields.prepayment`).
- `prepayment = 0` → server `payment = "unpaid"` saqlaydi (front ham shunday yuboradi).
- `prepayment > 0` → `payment` majburiy, `/payment-types` da bo‘lishi va `unpaid` / `mixed` **bo‘lmasligi** kerak (aks holda 422, `fields.payment`).
- `POST /book`: `prepayment > 0` bo‘lsa — `book_prepayments` ga birinchi yozuv.
- `PUT /book/{id}`: `prepayment` — yangi **jami** qiymat (tuzatish). O‘zgargan bo‘lsa `book_prepayments` ga farq yozilmaydi, faqat `book.prepayment` yangilanadi; jurnalda `changes` ichida `"prepayment"`.
- `GET /book` va barcha `BookEntry` javoblarida `reg.prepayment` doim bor (son).

## 4-bosqich. YANGI: `POST /book/{id}/prepayments` — «Oldindan to‘lov kiritish»

- Kirish: `book` bo‘limi.
- So‘rov: `{ "amount": 150000, "payment": "uzcard" }`
- `amount` > 0 (aks holda 422, `fields.amount`); `payment` — 3-bosqichdagi qoida.
- Server: `book.prepayment += amount`, `book_prepayments` ga yozuv.
- `book.payment`: barcha kiritishlar bir xil usulda — shu usul; har xil — `mixed`.
- Javob: 200, yangilangan `BookEntry` (`{ id, reg, receipt }`, `GET /book` formatida).
- Topilmadi → 404 `book.notFound`.
- Jurnal: `guest.prepayment` (8-bosqich).

## 5-bosqich. `GET /rooms` — `guests[].prepayment`

```json
{ "name": "Karimova Zarina", "doc": "AA 1234567", "checkin": "2026-11-10T14:00:00", "checkout": null,
  "sum": 300000, "prepayment": 200000, "pay": "paid" }
```

- `sum` — kunlik narx (`reg.amount`), `prepayment` — jami oldindan to‘lov (yo‘q — 0).
- Chiqarish javobidagi `Room` ham shu formatda.

## 6-bosqich. Chiqarish — `POST /rooms/{number}/checkout`

So‘rov (yangi maydonlar — `prepayment`, `paid`, `debt`):

```json
{
  "docs": ["AA 1234567"],
  "amount": 900000,
  "prepayment": 200000,
  "paid": 600000,
  "debt": 100000,
  "payment": "mixed",
  "paidCard": 400000,
  "paidCash": 200000,
  "receipt": "000123",
  "receiptData": { "...": "..." },
  "blacklistReason": null
}
```

- `amount` — **to‘lanishi kerak** (jami): front hisoblaydi (kunlik narx × kunlar), foydalanuvchi o‘zgartira olmaydi.
- `prepayment` — chiqayotgan mehmonlarning jami oldindan to‘lovi.
- `paid` — mehmon chiqishda to‘lagan summa («Сумма» maydoni).
- `debt = max(0, amount − prepayment − paid)`. Server tekshiradi; mos kelmasa 422, `fields.debt`.
- `payment = "mixed"` bo‘lsa: `paidCard + paidCash = paid` (avval `= amount` edi — **shu qoida o‘zgaradi**).
- **Qarz**: `debt > 0` bo‘lsa front chiqarish muvaffaqiyatli bo‘lgandan keyin o‘zi `POST /debts` chaqiradi (`debtor` = chiqayotgan mehmonlar F.I., `reason` = administrator kiritgan sabab, `sum = debt`). Backend chiqarishda qarzni **o‘zi yaratmasin** (ikki marta yozilmasin) — faqat arxivga `debt` ni saqlasin.
- Fiskal chek (`POST /fiscal/receipts`) endi **`paid`** summasiga so‘raladi. `receiptData.items`: «Проживание» (jami), keyin bo‘lsa «Предоплата» va «Долг» (minus bilan); `receiptData.amount` = `paid`. Backend blankani o‘zgartirmasdan saqlaydi (avvalgidek).
- Arxivga (birinchi chiqayotgan mehmonga, avvalgidek): `sum = amount`, `prepayment`, `paid`, `debt`, `checkoutPayment`, `paidCard`, `paidCash`. Qolganlarga — 0 / null.
- `GET /guests/archive` javobiga `prepayment`, `paid`, `debt` qo‘shiladi.
- Eski front `prepayment`/`paid` yubormasa: `prepayment = 0`, `paid = amount`, `debt = 0` deb ol.

## 7-bosqich. YANGI: `POST /debts/{id}/payments` — «Qarzni to‘lash»

«To‘lovlar va xarajatlar → Qarzlar» jadvalidagi «To‘lash» tugmasi.

- Kirish: `payments` bo‘limi.
- So‘rov: `{ "amount": 50000, "payment": "cash" }`
- `amount` > 0 va `amount ≤ debt.sum` (aks holda 422, `fields.amount`); `payment` — `/payment-types` kodi, `unpaid` / `mixed` emas (aks holda 422, `fields.payment`). Topilmadi → 404 `debts.notFound`.
- `amount = debt.sum` → qarz **o‘chiriladi**, javob: `200 { "debt": null }`.
- `amount < debt.sum` → `debt.sum -= amount`, javob: `200 { "debt": { ...Debt, "sum": <qoldiq> } }` (`GET /debts` formatida).
- Har bir to‘lov `debt_payments` ga yoziladi.
- Bu amalda `debt.update` / `debt.delete` jurnalga **yozilmasin** — faqat 8-bosqichdagi bitta yozuv.

## 8-bosqich. Harakatlar jurnali (`/audit-log`)

Front `params` dagi quyidagi kalitlarni o‘qib, asosiy matnga qo‘shadi (faqat `guest.*`, `debt.payment`, `debt.paidOff` amallarida). Barcha qiymatlar — **string**; summalar raqam ko‘rinishida (`"300000"`), `payment` — kod (`"cash"`). Bo‘sh / yo‘q kalit ko‘rsatilmaydi.

| action | params |
|---|---|
| `guest.checkin` | `target` (F.I.), `room`, `price` (kunlik narx), `prepayment` (> 0 bo‘lsa), `payment` (oldindan to‘lov bo‘lsa) |
| `guest.prepayment` **YANGI** | `target`, `room`, `sum` (kiritilgan), `prepayment` (yangi jami), `payment` |
| `guest.update` | `target`; `changes` ichida o‘zgarganlari: `amount`, `prepayment`, `payment`, … |
| `guest.checkout` | `target`, `room`, `sum` (to‘lanishi kerak — jami), `prepayment`, `paid`, `debt` (> 0 bo‘lsa), `payment` |
| `debt.create` | avvalgidek (chiqarishdagi qarz ham shu yo‘l bilan yoziladi) |
| `debt.payment` **YANGI** (qisman) | `target` (qarzdor), `sum` (to‘langan), `rest` (qoldiq), `payment` |
| `debt.paidOff` **YANGI** (to‘liq, qarz o‘chdi) | `target`, `sum`, `rest` = `"0"`, `payment` |

Front ko‘rinishi (misol):

> Sherzod Nazarov — «Zarina Karimovani 302-xonadan chiqardi — summa 900 000 so‘m, oldindan to‘lov 200 000 so‘m, to‘landi 600 000 so‘m, qarzga 100 000 so‘m, to‘lov usuli: Aralash»
> Sherzod Nazarov — «Qarz bo‘yicha qisman to‘lov qabul qildi: Karimova Zarina — summa 50 000 so‘m, qoldiq 50 000 so‘m, to‘lov usuli: Naqd»

## 9. Yangi xato kodlari

| HTTP | code |
|---|---|
| 404 | `book.notFound`, `debts.notFound` (agar hali yo‘q bo‘lsa) |
| 422 | `validation.failed` — `fields.prepayment`, `fields.payment`, `fields.amount`, `fields.debt` |

## 10. Yakuniy tekshiruv (oxirida hisobot ber)

- [ ] Migratsiya toza va mavjud bazada o‘tadi; eski yozuvlarda `prepayment = 0`, `debt = 0`.
- [ ] `POST/PUT/GET /book` — `reg.prepayment`; `payment` qoidalari (`unpaid` / `mixed` taqiqi).
- [ ] `POST /book/{id}/prepayments` — yig‘iladi, `book_prepayments`, `mixed` qoidasi, 404/422.
- [ ] `GET /rooms` → `guests[].prepayment`.
- [ ] Chiqarish: `prepayment`, `paid`, `debt` tekshiruvi; `mixed` uchun `paidCard + paidCash = paid`; arxivga yoziladi; qarzni backend o‘zi **yaratmaydi**; `/guests/archive` da yangi maydonlar.
- [ ] `POST /debts/{id}/payments` — to‘liq: o‘chadi (`debt: null`), qisman: qoldiq; `debt_payments`; 404/422.
- [ ] Jurnal: `guest.checkin`, `guest.prepayment`, `guest.update`, `guest.checkout`, `debt.payment`, `debt.paidOff` — 8-bosqichdagi `params` bilan.
- [ ] Barcha testlar o‘tadi; Swagger yangilangan.
- [ ] Hisobot: nima qilindi, qaysi fayllar o‘zgardi, migratsiya nomlari, shartnomadan chetga chiqishlar (sababi bilan).
