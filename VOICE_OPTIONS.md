# Voice options for AtsuMail

Written 2026-11-15. A rough comparison, kept here in case the voice plan needs to change later.

## Decision

**Stay on Azure, Free (F0) plan.** It sounds natural in Japanese, works on PC and Pixel, and cannot charge anything: it simply stops at the monthly limit.

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
