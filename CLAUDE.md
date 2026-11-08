# Project instructions: Maria's private legal-practice demo

## Project identity and prototype status

- Maria is a fictional educational character. Do not invent a surname, qualifications, tax identifiers, clients, real legal services, or contracts. Personal credentials do not exist and will not be provided after a contract.
- Clearly identify the site as an educational demo. The public GitHub Pages version does not submit or persist form data.
- The main page action is “Посмотреть демо-форму”; there is no real intake, contract, payment, or legal service.

## Source of truth and architecture

- Follow `structure.md` for the page sequence, copy, visual profile, calculator model, privacy boundaries, and demo behavior.
- `data/app.json` is the canonical public configuration for demo mode, calculator prices, limits, and allowed values. Do not add fallback prices or limits in formulas.
- `js/domain/` contains pure calculation logic only: no browser APIs, DOM, storage, network, or UI concerns. Money is integer kopecks, rounded deterministically half-up to the nearest 100 RUB as specified in `structure.md`.
- The `send.php` target is an educational Zero-Trust reference implementation following Z1–Z20, exercised only with isolated sandbox tests. Do not describe the current handler as compliant or deploy it until it has been brought to that standard and the tests pass.
- The web client in `mode: "demo"` must keep the form local: no network request containing form data, no fabricated order or success claim. Demo behavior comes from `data/app.json`, never from `.github.io` hostname detection. Any live request requires an explicit live configuration and HTTPS.
- Use bundled local fonts only; do not request fonts from Google Fonts or other external font/CDN hosts.

## Privacy and form behavior

- `localStorage` may contain only `docType`, `disputeCategory`, `workFormat`, and `urgency`; never store personal or case information.
- The short situation description is optional and limited to 500 characters.
- The checkbox acknowledges the demo mode; it is not consent to process personal data. It is unchecked by default and gates only the local demo check.
- Copy and Telegram / WhatsApp actions remain disabled at all times.
- Do not collect, persist, or send real personal data from the public demo.

## Assets and validation

- Use only the existing local assets in `images/`: `hero-maria.jpg`, `about-maria-work.jpg`, `dossier-flatlay.jpg`, `court-preparation.jpg`, and `og-cover.jpg`. Do not add external image URLs or generated placeholders.
- Do not run scripts, tests, PHP, browser automation, screenshots, or servers unless the user explicitly changes the environment restrictions. Validate code changes only with `get_errors` / editor diagnostics.
- Work on one stage per request. Stop after the requested stage and report changed files.
