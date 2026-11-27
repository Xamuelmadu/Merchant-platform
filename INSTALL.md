# Guava Product Education Email Sequence — backend add-on

This add-on targets the backend in the supplied archive (Express 5, MongoDB/Mongoose, Resend, node-cron).

## Included
- `models/marketingSubscriber.js`: explicit consent, subscriber status, tokenized unsubscribe, sequence cursor.
- `services/marketingEmailService.js`: seven education emails, Resend delivery, due processing, retry after six hours.
- `controllers/marketingController.js`: public opt-in and unsubscribe endpoints.
- `routes/marketingRoutes.js`: route definitions.
- `cron/marketingEmailCron.js`: five-minute scheduler.
- `server.integration.js.txt`: exact server integration snippets.

## Install
Copy the folders/files into the matching backend paths. Then apply the two snippets in `server.integration.js.txt` to your existing `server.js`:
1. Register `marketingRoutes` with the other route constants.
2. Mount `/api/marketing` after `express.json()` and start the cron after database connection succeeds.

Set `GUAVA_PUBLIC_URL=https://www.guavabyinvite.com` and ensure `EMAIL_FROM` is a verified sender/domain in Resend. Existing `RESEND_API_KEY` is reused. Do not use the Resend test sender for production campaigns.

## Subscribe
`POST /api/marketing/subscribe`
```json
{"name":"Ada","email":"ada@example.com","consent":true,"source":"settings-page"}
```
Consent must be explicit. Existing Guava accounts are NOT automatically enrolled.

## Unsubscribe
`GET /api/marketing/unsubscribe?token=...` or one-click `POST /api/marketing/unsubscribe` with `token` in form body. Unsubscribe suppresses all future sequence sends.

## Schedule
Email 1 immediately; email 2 day 2; email 3 day 4; email 4 day 6; email 5 day 9; email 6 day 12; email 7 day 15. Scheduler checks every five minutes and sends up to 25 due messages per run.

## Notes before production
- Confirm Guava's live feature descriptions/URLs and sender identity.
- Add consent checkbox to the actual signup/settings UI; don't enroll users merely because they have an account.
- Consider a verified sending domain and Resend suppression/bounce handling. This add-on handles opt-out but does not yet process Resend delivery/bounce webhooks or open/click tracking.
- `List-Unsubscribe` headers are set; a signed unsubscribe endpoint is token-based.
