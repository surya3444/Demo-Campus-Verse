# Payment Gateway: Razorpay vs Cashfree — Campus Verse

**Decision needed:** which PG powers fee collection for a multi-tenant
Indian education ERP?

> **Disclaimer:** Public rate cards change frequently. Numbers below are
> approximate (2025–26 public rates) and must be re-verified with each
> vendor's sales team before signing. Negotiated rates for 1 Cr+/month
> volumes are typically 0.10–0.30% lower than card-rate.

---

## TL;DR — Our Recommendation

**Stick with Razorpay.** Three reasons, in order:

1. **Already scaffolded** — `apps/api/src/config/env.ts` has
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` env
   vars. Switching to Cashfree = ~3 days of integration + webhook + test
   re-work with zero user-facing benefit.
2. **Split Payments (Razorpay Route) is more mature than Cashfree Easy
   Split.** We _will_ need this — we collect on behalf of each school
   tenant and need automated settlement to their individual bank accounts.
3. **Pricing gap is <0.25%** for our blended mix (heavy UPI, moderate
   cards, occasional netbanking). On ₹50K fees that's ₹125. Only material
   at > ₹1 Cr/month combined GMV.

**Revisit only if:** combined tenant GMV crosses ~₹1 Cr/month → negotiate
with Razorpay first (they'll match Cashfree), then consider switch.

---

## Side-by-side

| Dimension                                             | Razorpay                                                                         | Cashfree                                                           | Winner                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------ |
| **Domestic card (standard)**                          | 2% + GST                                                                         | 1.90% + GST                                                        | Cashfree (marginal)      |
| **UPI < ₹2000**                                       | 0% (NPCI subsidy)                                                                | 0%                                                                 | Tie                      |
| **UPI > ₹2000**                                       | 0% (zero MDR policy)                                                             | 0%                                                                 | Tie                      |
| **Netbanking**                                        | 1.9% + GST                                                                       | 1.8% + GST                                                         | Cashfree                 |
| **International cards**                               | 3% + GST                                                                         | 3% + GST                                                           | Tie                      |
| **Wallets**                                           | 2% + GST                                                                         | 2% + GST                                                           | Tie                      |
| **EMI**                                               | 2–3% + GST                                                                       | 2–3% + GST                                                         | Tie                      |
| **Settlement cycle (default)**                        | T+2                                                                              | T+1 working day                                                    | Cashfree                 |
| **Instant settlement**                                | Yes (Razorpay X)                                                                 | Yes (Cashfree Instant Settlements)                                 | Tie                      |
| **Split payments**                                    | **Razorpay Route** — mature, multi-level splits, sub-merchant onboarding via API | Cashfree **Easy Split** — works, but less mature sub-merchant flow | **Razorpay**             |
| **Sub-merchant onboarding**                           | Standard KYC via API, 1–2 days                                                   | Similar, sometimes slower                                          | Razorpay (by experience) |
| **Payment Links**                                     | Yes, with SMS/email/WA                                                           | Yes                                                                | Tie                      |
| **UPI AutoPay / Mandates**                            | Supported (UPI 2.0 + eNACH)                                                      | Supported                                                          | Tie                      |
| **Subscription billing**                              | Razorpay Subscriptions (mature)                                                  | Cashfree Subscriptions                                             | Razorpay                 |
| **QR codes**                                          | Dynamic + static                                                                 | Dynamic + static                                                   | Tie                      |
| **Refund partial / full**                             | Standard (free for domestic)                                                     | Standard (free for domestic)                                       | Tie                      |
| **Webhook reliability**                               | Industry-standard retries, signed                                                | Industry-standard retries, signed                                  | Tie                      |
| **Node.js SDK**                                       | `razorpay` — widely adopted, well-typed                                          | `cashfree-pg` — improving, smaller community                       | Razorpay                 |
| **Dashboard (finance team)**                          | Mature, role-based, audit logs                                                   | Functional, fewer RBAC features                                    | Razorpay                 |
| **Payout API (vendor refunds, staff reimbursements)** | Razorpay X — separate product, strong                                            | Cashfree Payouts — best-in-class in India                          | **Cashfree**             |
| **PCI-DSS / RBI tokenization**                        | Full compliance                                                                  | Full compliance                                                    | Tie                      |
| **Onboarding KYC for us (merchant)**                  | 2–5 days                                                                         | 2–5 days                                                           | Tie                      |
| **Support for education vertical**                    | Dedicated education team                                                         | Dedicated education team                                           | Tie                      |
| **Downtime history (2023–2025)**                      | Comparable — both had minor incidents                                            | Comparable                                                         | Tie                      |

---

## Fit against Campus Verse specifically

### Collection patterns we'll see

- **Parents paying monthly/quarterly fees** — ₹2K–₹50K per transaction, heavy UPI
- **One-time admission fees** — ₹5K–₹2L, mix of UPI/netbanking/cards
- **Transport fees** — recurring monthly ₹1K–₹5K
- **Hostel fees** — semester, ₹20K–₹1L
- **Partial payments** (we already have UI for this)
- **Refunds** (fee concessions, withdrawals)

Blended mix will be **~70% UPI, 15% cards, 10% netbanking, 5% other**
based on typical Indian school parent behavior. That means **the MDR gap
is almost entirely on the 15% card tail** — and zero on the dominant UPI
flow. Price difference is genuinely small.

### Features we care about most

| Feature                               | Why                                                  | Razorpay                 | Cashfree          |
| ------------------------------------- | ---------------------------------------------------- | ------------------------ | ----------------- |
| Split to tenant bank accounts         | Multi-tenant SaaS — each school settles separately   | ✓ Route (mature)         | ✓ Easy Split (ok) |
| Recurring auto-debit for monthly fees | Reduces manual follow-up                             | ✓                        | ✓                 |
| Invoice generation linked to payment  | We generate receipts in-app; PG invoice nice-to-have | ✓                        | ✓                 |
| Payment Links via WhatsApp/SMS        | Parents often prefer links over portal               | ✓                        | ✓                 |
| Webhooks for status reconciliation    | Our `payment-events` collection needs these          | ✓                        | ✓                 |
| Offline receipt reconciliation        | Some parents pay cash → mark paid in-app             | N/A (handled in our app) | N/A               |

### What Cashfree wins on for us

- **Cashfree Payouts** is genuinely better — if we later build **staff
  reimbursement**, **vendor payouts**, or **refund at scale**, Cashfree's
  payout infra is best-in-class. But this is not a day-1 need.
- **T+1 default settlement** helps school finance teams see cashflow
  faster. Razorpay can match with paid add-ons.

---

## Integration cost if we switched to Cashfree

| Task                                                           | Effort                  |
| -------------------------------------------------------------- | ----------------------- |
| Replace `razorpay` SDK with `cashfree-pg`                      | 1 day                   |
| Rewrite order creation, payment verification, webhook verifier | 1–2 days                |
| Update `payment-events` collection mapper                      | 0.5 day                 |
| Re-test end-to-end flows (7+ payment paths)                    | 1–2 days                |
| Update env configs, deployment secrets, docs                   | 0.5 day                 |
| Regression testing fee collection, partial payments, refunds   | 1 day                   |
| **Total**                                                      | **~5–7 developer-days** |

Plus business risk: any missed webhook during cutover = manual
reconciliation pain.

---

## Decision framework

Use this order:

1. **Are we already integrated with Razorpay in code?** → Yes (env vars
   scaffolded). ⇒ Default to Razorpay unless #3 triggers.
2. **Is monthly combined tenant GMV > ₹1 Cr?** → No (pre-launch). ⇒ Price
   difference is noise. Stay on Razorpay.
3. **Do we need best-in-class Payouts (vendor/refund) as a v1 feature?**
   → No (refunds via PG's standard refund API is fine). ⇒ Stay on
   Razorpay.
4. **When #2 flips to Yes**: negotiate Razorpay volume rates first.
   Switching is only justified if Razorpay won't match Cashfree ±0.10%.

---

## Action items

- [ ] Keep Razorpay for v1 launch.
- [ ] When first tenant crosses ₹50L/month collection, book a call with
      Razorpay account manager to renegotiate slab.
- [ ] Document all Razorpay integration points in
      `docs/04-API-ENDPOINTS.md` so a future migration has a clear scope.
- [ ] Build finance module PG operations behind a thin adapter interface
      (`IPaymentGateway` with `createOrder`, `verifyPayment`,
      `refund`, `createRoute`, `splitPayment`) so a future switch is
      ~2 days instead of a week.

---

## References

- Razorpay pricing: https://razorpay.com/pricing/
- Cashfree pricing: https://www.cashfree.com/payment-gateway-charges/
- Razorpay Route: https://razorpay.com/route/
- Cashfree Easy Split: https://www.cashfree.com/easy-split/
- UPI zero-MDR policy (NPCI): confirmed via RBI circular, P2M <₹2000 zero
  MDR; P2M ≥₹2000 also zero MDR as of Jan 2020 until govt subsidy ends
