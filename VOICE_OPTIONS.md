# Voice options for AtsuMail

Written 2026-11-15, updated 2026-11-17. A rough comparison, kept here in case the voice plan needs to change later.

## Decision

**Stay on Azure, Free (F0) plan.** It sounds natural in Japanese, works on PC and Pixel, and cannot charge anything: it simply stops at the monthly limit.

## Can Azure charge the card? (checked 2026-11-17)

Short answer: **not by reaching the character limit.** A charge needs a deliberate change in the Azure portal.

There are two separate things in Azure:

| Thing | Now | What it decides |
|---|---|---|
| **The account** ("Azure subscription 1") | 30-day free trial, started 2026-11-15 | Whether Microsoft is *able* to bill the card |
| **The Speech resource** (`atsumail-speech`) pricing tier | **Free (F0)** | What happens at the limit: on Free it **stops** until the 1st of next month |

Two locks before any money moves:

1. AtsuMail stops sending at its own limit (default 450,000) and the count turns pink at 80%.
2. Azure's Free tier stops at 500,000 characters a month. It never switches to paid by itself.

### The 30-day trial (ends about 2026-12-15)

- When the trial ends, Microsoft **disables** the account. The Azure voice stops working. Nothing is charged.
- To keep the Azure voice: in the Azure portal choose **Upgrade** (to "pay-as-you-go"). The Speech resource stays on Free and still stops at the limit.
- Downside of upgrading: the account as a whole can then bill the card. The Free tier still protects the voice, but these would cost money:
  - changing the Speech **Pricing tier** from Free to Standard (S0),
  - creating any other paid service in the account.
- If upgrading, set a **budget alert** first (Azure portal → Cost Management → Budgets, for example $1). It is free and emails when anything is spent.
- Or do not upgrade: use **Voice → Device** (free, no limit).

### How to check at any time

1. Open https://portal.azure.com
2. Click **atsumail-speech**. The line **Pricing tier** must say **Free**.
3. Click **Subscriptions → Azure subscription 1**. **Current cost** must say **$0.00**.
4. **All resources** must list only `atsumail-speech`.

### Notes

- The $1 seen on the card on 2026-11-16 was Microsoft's temporary card check at sign-up. Microsoft says it is reversed. Azure showed $0.00 spent.
- Not confirmed: Microsoft's free list shows the Speech allowance with a "12 months" label. Re-check around **October 2027** that the Free tier still works and still stops at the limit.

## If the free amount runs out

Not expected. The free amount is about 8-9 long newsletters a month, and the count in the voice player turns pink at 80%.

If it does happen, choices in order:

1. **Wait for next month.** The count resets on the 1st. Use **Voice → Device** until then (free, no limit).
2. **Pay for Azure (Standard, S0 plan).** Same voice, same app, nothing to rebuild.
   - Price: about **$15 per 1 million characters** (figure from a third-party page quoting Azure; Azure's own page shows prices only after choosing a region, so check before switching).
   - Japanese characters count double, so one long newsletter (28,000 characters) is about 56,000 counted characters = roughly **$0.85**.
   - Not confirmed: whether the paid plan still includes the 500,000 free characters. Assume it does not.
   - How: Azure portal → Speech resource `atsumail-speech` → **Pricing tier** → change F0 to S0. Then raise the limit in AtsuMail ⚙ (the app's own limit is what keeps the bill small).
   - Before switching, set a **budget alert** in the Azure portal (Cost Management → Budgets) so an email arrives if spending passes a chosen amount.
3. **Try Google Cloud Text-to-Speech** (see below). Needs new code in AtsuMail and a check of the unconfirmed points first.

## Comparison

| Service | Free amount for natural voices | Can it charge? | Fit for AtsuMail |
|---|---|---|---|
| **Azure** (in use) | 500,000 characters a month, Japanese counted double | No on F0. Yes on S0 | Working now |
| **Google Cloud Text-to-Speech** | 1 million characters a month, Japanese counted once | Yes, past the free amount | Strongest alternative: about 35 long newsletters a month free |
| **Google Gemini voice (AI Studio)** | Free on some models | No, it just stops | Daily limit looks too small (users report about 10-100 requests a day) |
| **Amazon Polly** | 1 million a month, first 12 months only | Yes | Awkward without a server |
| **OpenAI** | No free tier found | Prepaid | About $15 per million characters |
| **ElevenLabs** | About 10 minutes a month | No, free plan stops | Far too small |
| **Device voice** (built in) | Unlimited | No | Free fallback; more robotic in Japanese on Pixel, good in Edge on PC |
| **Natural (PC)** (Kokoro, on-device) | Unlimited | No | PC only; too slow on Pixel |

## Not confirmed (check before building anything new)

- Whether each service can be called straight from the browser with no server. Google Cloud probably can; not tested.
- Whether a credit card is needed to sign up for each.
- How good each one's Japanese is for long reading. Nothing was tried by ear.
- OpenAI and ElevenLabs prices came from third-party pages.

## Sources

- https://azure.microsoft.com/pricing/details/cognitive-services/speech-services
- https://cloud.google.com/text-to-speech/pricing
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://aws.amazon.com/polly/pricing/
