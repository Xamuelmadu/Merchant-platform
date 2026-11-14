const mongoose = require("mongoose")

const MarketingSubscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  name: { type: String, trim: true, default: "" },
  consent: { type: Boolean, required: true, default: false },
  consentSource: { type: String, default: "guava-marketing-form" },
  consentAt: { type: Date, default: null },
  status: { type: String, enum: ["active", "unsubscribed"], default: "active", index: true },
  unsubscribeToken: { type: String, required: true, unique: true, index: true },
  campaign: { type: String, default: "guava-product-education" },
  currentStep: { type: Number, default: 0 },
  nextSendAt: { type: Date, default: null, index: true },
  completedAt: { type: Date, default: null },
  lastSentAt: { type: Date, default: null },
  sentMessageIds: { type: [String], default: [] }
}, { timestamps: true })

module.exports = mongoose.models.MarketingSubscriber ||
  mongoose.model("MarketingSubscriber", MarketingSubscriberSchema)
