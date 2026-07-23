# Meta App Review — Go-Live Guide for the DM Bot

Everything needed to take the Instagram/Messenger bot from "works in testing" to "live for real patients." Do these in order. **Step 0 is a hard blocker — nothing else can start until it's done.**

App: **QSD DM** (App ID `1919107958760742`) · Page: Family Cosmetic & Implant Dentistry of Brooklyn (`164414886917837`)

---

## 0. Clear the developer-account block  ← DO THIS FIRST (only Igor can)
Go to developers.facebook.com → the "Account confirmation needed / unusual activity" screen → **Confirm Account** and complete Meta's steps. Until this clears, the app dashboard is locked and none of the steps below are reachable.

## 1. Business Verification
Meta requires the business behind the app to be verified before it can message the public.
- Where: **developers.facebook.com → App → App Settings → Basic → "Start verification,"** or Meta Business Suite → Business Settings → Security Center.
- Have ready: legal business name (Quentin Smile Dental PC), business address (2148 Ocean Ave, Ste 401, Brooklyn NY 11229), phone, and a verification document (business license, utility bill, or bank statement showing the business name + address).
- Timeline: usually a few days.

## 2. Add the Privacy Policy URL
- Privacy policy is hosted at: **https://dental-chat-api.vercel.app/privacy.html** (deployed from this repo, `public/privacy.html`).
- Add it in **App Settings → Basic → Privacy Policy URL**.
- Also set a **Data Deletion** URL or instructions (can point to the same policy's "Your choices" section, or the office email).

## 3. Request permissions (App Review)
Request **Advanced Access** for:
- `pages_messaging` — to receive and reply to Facebook Messenger messages.
- `instagram_manage_messages` — to receive and reply to Instagram DMs (only if running IG DM ads/organic).
- (`pages_manage_metadata` is typically also needed to subscribe the page to webhooks — request if prompted.)

**Use-case text to paste into the App Review form** (edit to taste):
> Our app is the messaging assistant for our dental practice, Quentin Smile Dental. When someone messages our Facebook Page or Instagram account — usually after seeing one of our ads — the app receives the message via webhook, generates a helpful, on-topic reply about our services, hours, insurance, and booking, and sends it back through the Messenger/Instagram Send API. If the person shares a phone number, we email a callback request to our office and a real team member follows up. A human on our team can take over any conversation at any time. We request pages_messaging and instagram_manage_messages solely to receive and respond to messages that people send to our own Page/account. We do not message people who have not messaged us first, and we do not use message content for advertising.

## 4. Record the screencast demo (Meta requires it)
Record a short (30–90s) screen video showing the permission in use, from the reviewer's perspective:
1. Show the Facebook Page / Instagram profile.
2. As a test user (add yourself/staff under App Roles → Testers), send a DM like "How do I book an appointment?"
3. Show the bot's reply arriving in the thread.
4. Send a follow-up ("do you have Saturday?") and show the next reply.
5. Show leaving a phone number and the bot's confirmation.
Upload the video with the App Review submission.

## 5. Switch the app to Live mode
App dashboard top bar → toggle **Development → Live**. (Advanced Access permissions only take effect for the public once the app is Live AND the permission is approved.)

## 6. Confirm the plumbing, then live test (Claude can do this)
- Verify the Page is subscribed to the `messages` (and `messaging_postbacks`) webhook fields — already confirmed subscribed earlier: `messages` + `message_echoes`.
- Verify `PAGE_ACCESS_TOKEN` still authenticates (issued by app 1919107958760742).
- Send a real message from a non-test account and confirm the bot replies end to end.

---

## Notes / gotchas
- **Turn OFF any conflicting Meta automation** (native Instant Reply / Auto Reply in Business Suite Inbox) before go-live, or it will double-reply alongside the bot.
- The bot code, env vars, and signature verification are all done and deployed on Vercel — no code work remains. This is entirely a Meta-approvals process.
- App Review for messaging typically takes several days and can bounce back for fixes (usually privacy-policy or demo-clarity issues). Budget ~1–2 weeks end to end from a cleared account.
