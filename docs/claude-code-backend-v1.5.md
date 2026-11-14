# HotelOS (e-hotel) backend — v1.5 vazifasi: boshqaruv panelida daromad taqsimoti (Claude Code uchun)

> Bu fayl Claude Code uchun topshiriq. Uni backend loyihasining `docs/` papkasiga qo‘ying va Claude Code ga ayting:
> **«docs/claude-code-backend-v1.5.md faylidagi vazifani bajar»**.
> v1.5 — v1.4 ustiga qo‘shiladi (`book_prepayments`, `debt_payments`, chiqarishdagi `paid` allaqachon bor).

## 0. Ish qoidalari

- Javoblarni **o‘zbek tilida (lotin)** yoz.
- Mavjud uslubga moslash, yangi kutubxona qo‘shma, mavjud yo‘llarni buzma.
- Bazaga o‘zgarish kerak bo‘lsa — faqat yangi migratsiya orqali (bu vazifada odatda kerak emas).
- Oxirida testlar va Swagger (`/v3/api-docs`) ni tekshir, qisqa hisobot ber.

## 1. Nima o‘zgaradi

Boshqaruv panelida:
- **«Qarzlar»** kartochkasi — front uni `GET /debts` dan o‘zi hisoblaydi (backendda o‘zgarish yo‘q).
- **«Foyda»** kartochkasi bosilganda — «Foyda qayerdan» oynasi: daromad 3 manba bo‘yicha. Buning uchun `GET /dashboard` javobiga `income` qo‘shiladi.
- Qarz to‘langanda u **daromadga** (demak foydaga) qo‘shiladi. Chiqarishda qarzga yozilgan summa to‘lanmaguncha daromad **emas**.

## 2. `GET /dashboard?from=&to=` — YANGI maydon `income`

```json
{
  "...": "...",
  "daily": [ { "date": "2026-11-13", "revenue": 1450000, "expenses": 200000 } ],
  "income": {
    "stay": 1200000,
    "debts": 150000,
    "services": 100000
  }
}
```

`[from, to]` davri bo‘yicha (to‘lov **sanasi** bo‘yicha, sana va vaqt mehmonxona vaqtida):

| Maydon | Nima | Manba |
|---|---|---|
| `stay` | Mehmonlar yashashi uchun to‘lovlar | Σ `book_prepayments.amount` (`created_at` davrda) + Σ chiqarishdagi `paid` (chiqarish vaqti davrda) |
| `debts` | To‘langan qarzlar | Σ `debt_payments.amount` (`created_at` davrda) |
| `services` | Qo‘shimcha xizmatlar | Σ `extra_services.sum` (`date` davrda) |

Qoidalar:
- `daily[].revenue` = shu kundagi `stay + debts + services` (grafik va kartochkalar bir xil bo‘lishi uchun). `Σ daily.revenue = income.stay + income.debts + income.services`.
- `daily[].expenses` — o‘zgarmaydi (avvalgidek).
- Qarzning o‘zi (`POST /debts`, chiqarishdagi `debt`) daromad emas — faqat `debt_payments` dagi to‘lovlar.
- `PUT /book/{id}` orqali `prepayment` tuzatilishi `book_prepayments` ga yozilmaydi (v1.4) — u daromadni o‘zgartirmaydi.
- Ma’lumot bo‘lmasa — `0` (null emas).
- Kirish: `dashboard` bo‘limi (o‘zgarmaydi).

Front: `income` kelmasa (eski server) — butun daromadni «Yashash» deb ko‘rsatadi va ogohlantirish chiqaradi.

## 3. Swagger

`DashboardSummary` ga `income` (`DashboardIncome { stay, debts, services }`, hammasi `integer int64`, majburiy) qo‘sh.

## 4. Yakuniy tekshiruv

- [ ] `GET /dashboard` javobida `income` — uchala summa davr bo‘yicha to‘g‘ri.
- [ ] `Σ daily.revenue = stay + debts + services`.
- [ ] Qarz to‘lovi (`POST /debts/{id}/payments`) shu kunning `revenue` va `income.debts` ga tushadi; qarzning yaratilishi tushmaydi.
- [ ] Testlar o‘tadi; Swagger yangilangan.
- [ ] Hisobot: nima qilindi, qaysi fayllar o‘zgardi.
