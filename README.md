# Wedding invitation

A responsive EN/MK wedding invitation based on the supplied Sanja and Martin reference. Includes the animated opening, music control, countdown, venue directions, calendar export, timeline, dress code, persisted RSVP responses and a password-protected guest dashboard.

## Run locally

Requires Node.js 22.13 or newer. On Windows, use npm.cmd if PowerShell blocks npm.ps1.

```powershell
npm.cmd ci
npm.cmd run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_low_ulik.sql
npm.cmd run dev
```

The development server prints its local URL. Apply the migration once per new local database.

## Personalize

Edit `lib/wedding.ts` for names, date, timezone, venue, schedule and English/Macedonian wording. Update page metadata in `app/layout.tsx` and replace reference artwork, video and music in `public/assets` for your event. The initial event date is 16 August 2026 and the countdown displays its past-event state after that date.

## Guest management

Open `/admin`. The generated password is in the ignored local `.dev.vars` file as `ADMIN_PASSWORD`. The same value has been configured as a secret for the hosted preview. Keep this file private. Set a new password of at least 12 characters in both locations when changing it.

Responses are saved server-side in Cloudflare D1. A private update credential stored on the guest’s browser lets that guest revise their response. The dashboard supports search, attendance filters, companion and dietary details, CSV export and deletion. The hosted preview starts owner-private.

## Verify

```powershell
npx.cmd tsc --noEmit
npm.cmd run build
```

Source reference is [Sanja and Martin](https://sanjaandmartin.thedigitalyes.com/).
