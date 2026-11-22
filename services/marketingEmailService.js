
const crypto = require("crypto");
const { Resend } = require("resend");
const MarketingSubscriber = require("../models/marketingSubscriber");

const resend = new Resend(process.env.RESEND_API_KEY);

const CAMPAIGN_ID = "guava-product-education";

const FROM = () =>
  process.env.EMAIL_FROM || "Guava <onboarding@resend.dev>";

const BASE_URL = () =>
  (process.env.GUAVA_PUBLIC_URL || "https://www.guavabyinvite.com")
    .replace(/\/$/, "");

const DAY = 24 * 60 * 60 * 1000;

/*
|--------------------------------------------------------------------------
| PRODUCT EDUCATION EMAIL SEQUENCE
|--------------------------------------------------------------------------
|
| Seven emails sent on days:
| 0, 2, 4, 6, 9, 12, 15
|
*/

const lessons = [
  {
    subject: "Meet the new Guava",
    title: "Guava is evolving",
    body: `
      <p>Guava is building a more conversational way for shoppers to discover products in your store.</p>
      <p>Instead of relying only on filters and search boxes, shoppers can describe what they need in everyday language and get guided toward relevant products.</p>
      <p>This short series will walk you through the ideas behind conversational commerce and how to get more value from Guava.</p>
    `,
    cta: "Explore Guava",
    href: "/",
  },
  {
    subject: "Your store can have conversations",
    title: "From search terms to real questions",
    body: `
      <p>Traditional search starts with keywords. A conversational shopping experience starts with a shopper's question.</p>
      <p>Someone can explain what they are looking for, clarify preferences, and ask follow-up questions. That creates a more natural discovery journey than repeatedly changing search terms.</p>
      <p>Think of Guava as an additional discovery interface for your existing product catalogue—not a replacement for your store.</p>
    `,
    cta: "See conversational commerce",
    href: "/conversational-commerce",
  },
  {
    subject: "Beyond traditional product search",
    title: "A different way to discover products",
    body: `
      <p>Product search is useful when shoppers already know the exact words to type. It can be less helpful when they are comparing options or are unsure how to describe the right product.</p>
      <p>Conversational discovery lets shoppers express intent, constraints, and preferences in one interaction. The quality of the experience still depends on accurate, complete product information.</p>
      <p>That is why product data and conversation design work together.</p>
    `,
    cta: "Compare the approaches",
    href: "/ai-shopping-assistant-vs-product-search",
  },
  {
    subject: "Help shoppers find the right product",
    title: "Recommendations need context",
    body: `
      <p>A useful recommendation is not simply a popular product. It should reflect what the shopper asked for and the information available in your catalogue.</p>
      <p>Clear titles, descriptions, attributes, variants, and availability give an assistant better context to guide discovery.</p>
      <p>As you review your catalogue, look for missing details that a customer would need to make a confident choice.</p>
    `,
    cta: "Learn about product recommendations",
    href: "/ai-product-recommendations",
  },
  {
    subject: "Guava works with your commerce platform",
    title: "Keep your store; add a conversational layer",
    body: `
      <p>Guava is designed to connect with commerce platforms such as Shopify and WooCommerce. Your store remains the place where your catalogue and commerce operations live.</p>
      <p>The integration connects your product data to Guava so shoppers can use a conversational discovery experience alongside the store's existing shopping journey.</p>
      <p>Connection and sync status should be checked in your Guava dashboard whenever you make major catalogue changes.</p>
    `,
    cta: "Explore integrations",
    href: "/shopify",
  },
  {
    subject: "Get more value from Guava",
    title: "A few habits that improve discovery",
    body: `
      <p>Start with product data: use descriptive names, explain benefits and use cases, and keep variants and key attributes clear.</p>
      <p>Then test the experience as a shopper. Ask specific questions, try follow-up questions, and notice where your catalogue does not provide enough information.</p>
      <p>Use those observations to improve the product information customers rely on.</p>
    `,
    cta: "Read the product data guide",
    href: "/blog/product-data-quality-for-ai-commerce",
  },
  {
    subject: "Your next step with Guava",
    title: "Put conversational discovery to work",
    body: `
      <p>You have now seen the foundations: conversational shopping, product recommendations, platform integrations, and the role of product data.</p>
      <p>Your next step is simple: review your connected store, make sure your catalogue is informative, and try a few realistic shopper questions.</p>
      <p>Guava's product education will continue as new capabilities become available. We will keep these emails focused on practical learning.</p>
    `,
    cta: "Open your Guava dashboard",
    href: "/dashboard",
  },
];

/*
|--------------------------------------------------------------------------
| HTML ESCAPING
|--------------------------------------------------------------------------
*/

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]
  );
}

/*
|--------------------------------------------------------------------------
| ENROLMENT
|--------------------------------------------------------------------------
|
| Creates or reactivates a marketing subscriber.
| Generates a secure unsubscribe token.
|
| Existing active subscribers are not restarted.
|
*/

async function enrollMarketingSubscriber({
  email,
  name = "",
  source = "merchant-registration",
}) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  if (
    !normalizedEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    throw new Error("A valid email address is required.");
  }

  const now = new Date();

  let subscriber = await MarketingSubscriber.findOne({
    email: normalizedEmail,
  });

  // Do not restart an existing active sequence.
  if (
    subscriber &&
    subscriber.status === "active" &&
    subscriber.consent === true
  ) {
    return subscriber;
  }

  const values = {
    email: normalizedEmail,
    name: String(name || "").trim(),
    consent: true,
    consentSource: String(source || "merchant-registration").slice(0, 100),
    consentAt: now,
    status: "active",
    campaign: CAMPAIGN_ID,
    currentStep: 0,
    nextSendAt: now,
    completedAt: null,
    lastSentAt: null,
    sentMessageIds: [],
  };

  if (subscriber) {
    Object.assign(subscriber, values);

    if (!subscriber.unsubscribeToken) {
      subscriber.unsubscribeToken = crypto.randomBytes(32).toString("hex");
    }
  } else {
    subscriber = new MarketingSubscriber({
      ...values,
      unsubscribeToken: crypto.randomBytes(32).toString("hex"),
    });
  }

  await subscriber.save();

  return subscriber;
}

/*
|--------------------------------------------------------------------------
| RENDER EMAIL
|--------------------------------------------------------------------------
*/

function renderLesson(lesson, subscriber) {
  const unsubscribe =
    `${BASE_URL()}/api/marketing/unsubscribe?token=` +
    encodeURIComponent(subscriber.unsubscribeToken);

  const link = `${BASE_URL()}${lesson.href}`;

  const name = escapeHtml(subscriber.name || "there");

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#f5f6f8;font-family:Arial,sans-serif;color:#171717">
        <div style="max-width:600px;margin:0 auto;padding:28px 16px">

          <div style="font-weight:700;font-size:22px;margin:8px 0 20px">
            Guava
          </div>

          <div style="background:#fff;border-radius:14px;padding:32px">

            <p style="color:#666">
              Hello ${name},
            </p>

            <h1 style="font-size:26px;line-height:1.25">
              ${lesson.title}
            </h1>

            ${lesson.body}

            <p style="margin:28px 0">
              <a
                href="${link}"
                style="background:#171717;color:#fff;text-decoration:none;padding:13px 20px;border-radius:8px;display:inline-block"
              >
                ${lesson.cta}
              </a>
            </p>

            <p style="font-size:13px;color:#777">
              You are receiving this because you opted in to Guava product education.
            </p>

          </div>

          <p style="font-size:12px;color:#777;line-height:1.6;text-align:center">
            Guava · ${BASE_URL()}
            <br />

            <a href="${unsubscribe}" style="color:#777">
              Unsubscribe from product education
            </a>
          </p>

        </div>
      </body>
    </html>
  `;

  const text = `
Hello ${subscriber.name || "there"},

${lesson.title}

${lesson.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}

${lesson.cta}: ${link}

Unsubscribe: ${unsubscribe}
  `.trim();

  return {
    html,
    text,
    unsubscribe,
  };
}

/*
|--------------------------------------------------------------------------
| SEND ONE LESSON
|--------------------------------------------------------------------------
*/

async function sendLesson(subscriber, step) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const lesson = lessons[step];

  if (!lesson) {
    return null;
  }

  const content = renderLesson(lesson, subscriber);

  const result = await resend.emails.send({
    from: FROM(),
    to: [subscriber.email],
    subject: lesson.subject,
    html: content.html,
    text: content.text,
    headers: {
      "List-Unsubscribe": `<${content.unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (result.error) {
    throw new Error(result.error.message || "Resend failed");
  }

  return result.data?.id || null;
}

/*
|--------------------------------------------------------------------------
| PROCESS DUE MARKETING EMAILS
|--------------------------------------------------------------------------
|
| Called by marketingEmailCron.js every five minutes.
|
| Sends due emails in bounded batches.
| Failed emails are retried after six hours.
|
*/

async function processDueMarketingEmails({
  batchSize = 25,
} = {}) {
  const now = new Date();

  const due = await MarketingSubscriber.find({
    status: "active",
    consent: true,
    campaign: CAMPAIGN_ID,
    completedAt: null,
    nextSendAt: {
      $lte: now,
    },
  })
    .sort({ nextSendAt: 1 })
    .limit(batchSize);

  let sent = 0;
  let failed = 0;

  for (const subscriber of due) {
    const step = subscriber.currentStep;

    try {
      const messageId = await sendLesson(subscriber, step);

      subscriber.lastSentAt = new Date();

      if (messageId) {
        subscriber.sentMessageIds.push(messageId);
      }

      subscriber.currentStep = step + 1;

      if (subscriber.currentStep >= lessons.length) {
        subscriber.completedAt = new Date();
        subscriber.nextSendAt = null;
      } else {
        // Day offsets: 0, 2, 4, 6, 9, 12, 15.
        const offsets = [0, 2, 4, 6, 9, 12, 15];

        subscriber.nextSendAt = new Date(
          subscriber.consentAt.getTime() +
            offsets[subscriber.currentStep] * DAY
        );
      }

      await subscriber.save();

      sent++;
    } catch (error) {
      failed++;

      console.error(
        `[Marketing] ${subscriber.email} step ${step + 1} failed:`,
        error.message
      );

      // Retry after six hours without advancing the sequence.
      subscriber.nextSendAt = new Date(
        Date.now() + 6 * 60 * 60 * 1000
      );

      await subscriber.save();
    }
  }

  return {
    scanned: due.length,
    sent,
    failed,
  };
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  CAMPAIGN_ID,
  lessons,
  processDueMarketingEmails,
  renderLesson,
  enrollMarketingSubscriber,
};
