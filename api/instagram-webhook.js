// Instagram / Messenger DM webhook for Quentin Smile Dental
// -----------------------------------------------------------------------------
// Bridges Meta Direct Messages to the existing /api/chat bot (tenant: quentin-smile-dm).
//
// What it does:
//   - Verifies Meta's webhook handshake (GET) and payload signatures (POST).
//   - Remembers each person's conversation (Upstash Redis) so the bot has context.
//   - Human handoff: when a human replies from the Page/Inbox, the bot pauses for
//     that person for 24h (auto-resumes after). Type "/bot on" in a thread to resume
//     immediately, "/bot off" to pause manually.
//   - Lead capture: when a visitor leaves a phone number, it emails the office
//     (Resend), confirms to the visitor, and steps back so a human takes the close.
//
// Required environment variables (set these in Vercel > Project > Settings > Environment Variables):
//   META_VERIFY_TOKEN        - any string you invent; must match what you type into Meta's webhook setup
//   META_APP_SECRET          - your Meta app's App Secret (used to verify payloads are really from Meta)
//   PAGE_ACCESS_TOKEN        - Page access token with instagram_manage_messages / pages_messaging
//   UPSTASH_REDIS_REST_URL   - Upstash Redis REST URL (conversation memory + pause flags)
//   UPSTASH_REDIS_REST_TOKEN - Upstash Redis REST token
//   RESEND_API_KEY           - Resend API key for lead emails   [recommended]
//   LEAD_EMAIL_TO            - defaults to smile@dentistinbrooklyn.com
//   LEAD_EMAIL_FROM          - a from-address on a domain verified in Resend, e.g. leads@dentistinbrooklyn.com
//   CHAT_API_URL             - defaults to https://dental-chat-api.vercel.app/api/chat
//   BOT_TENANT_ID            - defaults to quentin-smile-dm
// -----------------------------------------------------------------------------

const crypto = require("crypto");

const CHAT_API_URL =
  process.env.CHAT_API_URL || "https://dental-chat-api.vercel.app/api/chat";
const TENANT_ID = process.env.BOT_TENANT_ID || "quentin-smile-dm";
const LEAD_EMAIL_TO = process.env.LEAD_EMAIL_TO || "smile@dentistinbrooklyn.com";
const LEAD_EMAIL_FROM = process.env.LEAD_EMAIL_FROM || "leads@dentistinbrooklyn.com";

const HISTORY_MAX = 12; // messages of context kept per person
const MEMORY_TTL = 60 * 60 * 24; // conversation remembered 24h
const PAUSE_TTL = 60 * 60 * 24; // bot stays paused 24h after a human replies

// ---------- tiny Upstash Redis REST helpers (no extra npm deps needed) ----------
async function redis(command) {
  // Vercel's Upstash integration injects KV_REST_API_*; fall back to UPSTASH_* names.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // memory/handoff disabled if not configured
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    const data = await r.json();
    return data.result;
  } catch (e) {
    console.error("Redis error:", e.message);
    return null;
  }
}
const rGet = (k) => redis(["GET", k]);
const rSetEx = (k, v, ttl) => redis(["SET", k, v, "EX", String(ttl)]);
const rDel = (k) => redis(["DEL", k]);

// ---------- helpers ----------
function verifySignature(rawBody, signatureHeader) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true; // not set -> skip (set it for production!)
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Detects a US-style phone number left by a visitor.
const PHONE_RE = /(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/;

async function callBot(history) {
  try {
    const r = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, tenantId: TENANT_ID }),
    });
    const data = await r.json();
    return (
      data.response ||
      "Thanks for reaching out! Please call or text our office at (718) 339-8852 and we'll help you right away."
    );
  } catch (e) {
    console.error("callBot error:", e.message);
    return "Thanks for reaching out! Please call or text our office at (718) 339-8852 and we'll help you right away.";
  }
}

async function sendMessage(recipientId, text) {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) {
    console.error("PAGE_ACCESS_TOKEN not set - cannot send reply");
    return null;
  }
  const r = await fetch(
    `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: { text },
      }),
    }
  );
  const data = await r.json();
  if (data.error) console.error("Send API error:", JSON.stringify(data.error));
  // Remember our own outbound message id so its echo doesn't trigger a false handoff.
  if (data.message_id) await rSetEx(`botmid:${data.message_id}`, "1", 600);
  return data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Show "seen" + "typing…" so replies feel like a real person, not an instant bot.
async function sendAction(recipientId, action) {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) return;
  try {
    await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: recipientId }, sender_action: action }),
      }
    );
  } catch (e) {
    console.error("sendAction error:", e.message);
  }
}

// A human-feeling pause: scales with reply length, floored/capped for realism.
function humanDelayMs(text) {
  return Math.min(6000, Math.max(1800, (text ? text.length : 0) * 30));
}

async function emailLead(fromId, phone, history) {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set - lead not emailed. Phone:", phone);
    return;
  }
  const transcript = history
    .map((m) => `${m.role === "user" ? "Patient" : "Quentin"}: ${m.content}`)
    .join("\n");
  const body = [
    "New lead from an Instagram/Facebook DM.",
    "",
    `Callback number: ${phone}`,
    `Conversation ID: ${fromId}`,
    "",
    "--- Conversation ---",
    transcript,
  ].join("\n");
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: LEAD_EMAIL_FROM,
        to: [LEAD_EMAIL_TO],
        subject: `New DM lead - callback ${phone}`,
        text: body,
      }),
    });
  } catch (e) {
    console.error("Lead email error:", e.message);
  }
}

// ---------- main handler ----------
module.exports = async function handler(req, res) {
  // 1) Webhook verification handshake (GET) - Meta calls this once when you set up the webhook.
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 2) Read the raw body so we can verify Meta's signature.
  const raw = await getRawBody(req).catch(() => Buffer.alloc(0));
  let payload;
  if (raw && raw.length) {
    if (!verifySignature(raw, req.headers["x-hub-signature-256"])) {
      console.error("Invalid signature - rejecting");
      return res.status(401).json({ error: "Invalid signature" });
    }
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch (e) {
      return res.status(400).json({ error: "Bad JSON" });
    }
  } else if (req.body && !process.env.META_APP_SECRET) {
    // Only accept a pre-parsed body when we're not enforcing signatures at all.
    console.warn("Raw body unavailable; signature not enforced (no META_APP_SECRET).");
    payload = req.body;
  } else {
    // Fail closed: if a secret is configured but we can't verify, reject.
    console.error("Raw body unavailable; cannot verify signature - rejecting");
    return res.status(401).json({ error: "Cannot verify signature" });
  }

  // 3) Process events. Haiku is fast, so we handle then return 200.
  try {
    const entries = payload.entry || [];
    for (const entry of entries) {
      const events = entry.messaging || [];
      for (const event of events) {
        await handleEvent(event);
      }
    }
  } catch (e) {
    console.error("Webhook processing error:", e.message, e.stack);
  }

  return res.status(200).send("EVENT_RECEIVED");
};

async function handleEvent(event) {
  const message = event.message;
  if (!message) return; // ignore reactions, read receipts, postbacks (v1)

  // ----- Echo: a message the Page sent (a human in the Inbox OR our own bot) -----
  if (message.is_echo) {
    // Messages sent by THIS app carry our app_id in the echo. Those are the bot's
    // own replies -> never treat them as a human takeover.
    const ourAppId = process.env.META_APP_ID || "1919107958760742";
    if (message.app_id && String(message.app_id) === ourAppId) return;
    // Fallback dedupe by message id in case app_id is absent.
    const isOurs = message.mid ? await rGet(`botmid:${message.mid}`) : null;
    if (isOurs) return;
    // A real human replied from the Page/Inbox -> pause the bot for that person.
    const userId = event.recipient && event.recipient.id;
    if (userId) {
      await rSetEx(`paused:${userId}`, "1", PAUSE_TTL);
      console.log("Human takeover - bot paused for", userId);
    }
    return;
  }

  // ----- Inbound message from a visitor -----
  const senderId = event.sender && event.sender.id;
  const text = (message.text || "").trim();
  if (!senderId || !text) return;

  // Manual bot toggles (type these yourself into a thread if you ever need to).
  if (text === "/bot off") {
    await rSetEx(`paused:${senderId}`, "1", PAUSE_TTL);
    return;
  }
  if (text === "/bot on") {
    await rDel(`paused:${senderId}`);
    return;
  }

  // Respect human handoff.
  const paused = await rGet(`paused:${senderId}`);
  if (paused) {
    console.log("Bot paused for", senderId, "- skipping");
    return;
  }

  // Load prior conversation.
  let history = [];
  const stored = await rGet(`conv:${senderId}`);
  if (stored) {
    try {
      history = JSON.parse(stored);
    } catch (e) {
      history = [];
    }
  }
  history.push({ role: "user", content: text });

  // Human feel: mark the message seen and start a typing indicator before replying.
  await sendAction(senderId, "mark_seen");
  await sendAction(senderId, "typing_on");

  // Lead capture: the visitor left a phone number -> email the office and hand off.
  if (PHONE_RE.test(text)) {
    const phone = text.match(PHONE_RE)[0].trim();
    await emailLead(senderId, phone, history);
    const confirm =
      "Perfect, thank you! Someone from our team will reach out to you at that number shortly. Talk soon!";
    history.push({ role: "assistant", content: confirm });
    await rSetEx(
      `conv:${senderId}`,
      JSON.stringify(history.slice(-HISTORY_MAX)),
      MEMORY_TTL
    );
    await sleep(humanDelayMs(confirm));
    await sendMessage(senderId, confirm);
    await rSetEx(`paused:${senderId}`, "1", PAUSE_TTL); // hand to a human
    return;
  }

  // Normal path: ask the bot, reply, remember.
  const reply = await callBot(history.slice(-HISTORY_MAX));
  history.push({ role: "assistant", content: reply });
  await rSetEx(
    `conv:${senderId}`,
    JSON.stringify(history.slice(-HISTORY_MAX)),
    MEMORY_TTL
  );
  await sleep(humanDelayMs(reply));
  await sendMessage(senderId, reply);
}
