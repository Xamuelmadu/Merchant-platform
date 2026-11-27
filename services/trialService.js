const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000

function createTrialFields() {
  const startedAt = new Date()

  return {
    trial_started_at: startedAt,
    trial_ends_at: new Date(
      startedAt.getTime() + TRIAL_DURATION_MS
    ),
    trial_status: "active"
  }
}

function hasActiveTrial(user) {
  return Boolean(
    user &&
    user.trial_status === "active" &&
    user.trial_ends_at &&
    new Date(user.trial_ends_at).getTime() > Date.now()
  )
}

module.exports = {
  createTrialFields,
  hasActiveTrial
}