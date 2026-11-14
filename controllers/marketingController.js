const crypto = require("crypto")
const MarketingSubscriber = require("../models/marketingSubscriber")
const { CAMPAIGN_ID } = require("../services/marketingEmailService")

function makeToken() {
  return crypto.randomBytes(32).toString("hex")
}

async function subscribe(req, res) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase()
    const name = String(req.body.name || "").trim()
    const consent = req.body.consent === true
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "A valid email address is required." })
    }
    if (!consent) {
      return res.status(400).json({ success: false, message: "Explicit consent is required to receive product education emails." })
    }

    let subscriber = await MarketingSubscriber.findOne({ email })
    if (subscriber?.status === "active" && subscriber.consent) {
      return res.status(200).json({ success: true, message: "This email is already subscribed." })
    }
    const now = new Date()
    const values = {
      email, name, consent: true, consentSource: String(req.body.source || "guava-marketing-form").slice(0,100),
      consentAt: now, status: "active", campaign: CAMPAIGN_ID, currentStep: 0,
      nextSendAt: now, completedAt: null, lastSentAt: null, sentMessageIds: [],
      unsubscribeToken: subscriber?.unsubscribeToken || makeToken()
    }
    if (subscriber) Object.assign(subscriber, values)
    else subscriber = new MarketingSubscriber(values)
    await subscriber.save()
    return res.status(201).json({ success: true, message: "Subscribed to Guava product education." })
  } catch (error) {
    console.error("[Marketing] subscribe error:", error.message)
    return res.status(500).json({ success: false, message: "Unable to subscribe right now." })
  }
}

async function unsubscribe(req, res) {
  try {
    const token = String(req.query.token || req.body?.token || "")
    if (!token) return res.status(400).send("Missing unsubscribe token.")
    const subscriber = await MarketingSubscriber.findOne({ unsubscribeToken: token })
    if (!subscriber) return res.status(404).send("Subscription not found.")
    subscriber.status = "unsubscribed"
    subscriber.consent = false
    subscriber.nextSendAt = null
    await subscriber.save()
    return res.status(200).send(`<!doctype html><html><body style="font-family:Arial;padding:40px"><h2>You have been unsubscribed.</h2><p>You will no longer receive Guava product education emails.</p></body></html>`)
  } catch (error) {
    console.error("[Marketing] unsubscribe error:", error.message)
    return res.status(500).send("Unable to unsubscribe right now.")
  }
}

module.exports = { subscribe, unsubscribe }
