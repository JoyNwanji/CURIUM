# Curium AI setup

Curium serves its static pages and `/api/research` from a Cloudflare Worker. The browser calls that endpoint; provider keys stay in Cloudflare secrets.

## Configure providers

1. Sign in to Cloudflare and enable Workers AI for the account used to deploy Curium. The `AI` binding is already declared in `wrangler.toml`.
2. Create a Gemini API key in Google AI Studio and add it as the `GEMINI_API_KEY` Worker secret.
3. Optionally add an OpenRouter key as `OPENROUTER_API_KEY` for another fallback.
4. Deploy the folder as a Cloudflare Worker with static assets enabled.

From a trusted terminal with Wrangler installed and logged in, secrets can be added with `npx wrangler secret put GEMINI_API_KEY` and `npx wrangler secret put OPENROUTER_API_KEY`. Enter each key only in the terminal prompt or Cloudflare dashboard; never put keys in `app.js`, `results.js`, or this repository.

The provider order is Gemini, Cloudflare Workers AI, then OpenRouter. A provider error or quota response advances to the next configured provider. If all providers are unavailable, the page displays an error and offers the separate Nigerian curriculum search.

## Data and free-tier notes

The AI request includes the question, recent conversation turns, course and education context, plus short descriptions and URLs for the sources shown on the page. It does not send the learner's name or email. Avoid entering sensitive personal information. Google’s Gemini API terms describe different data handling for unpaid and paid services; review the current terms and account settings before launch. Free access and quotas can change and are account/model dependent. Cloudflare currently lists a daily free Workers AI allowance; OpenRouter’s free routing has request caps and model availability can change.

The curriculum search remains separate and links directly to Nigerian official sources, including NUC CCMAS, NERDC, WAEC, NECO, and JAMB where relevant. These links are discovery and reference links; Curium does not claim to reproduce every full curriculum document inside the page.
