const { Resend } = require("resend")


/*
================================
RESEND CLIENT
================================
*/

const resend = new Resend(
  process.env.RESEND_API_KEY
)


/*
================================
EMAIL CONFIGURATION
================================
*/

function getEmailFrom() {

  return (
    process.env.EMAIL_FROM ||
    "AI Commerce <onboarding@resend.dev>"
  )

}


/*
================================
EMAIL CONTENT
================================
*/

function getOtpEmailContent({
  otp,
  purpose
}) {

  const isSignup =
    purpose === "signup"


  const subject =
    isSignup
      ? "Verify your AI Commerce account"
      : "Your AI Commerce sign-in code"


  const title =
    isSignup
      ? "Verify your email"
      : "Sign-in verification"


  const description =
    isSignup

      ? "Use the verification code below to verify your AI Commerce account and complete your registration."

      : "Use the verification code below to securely complete your AI Commerce sign-in."


  return {

    subject,


    html: `

      <!DOCTYPE html>

      <html>

        <head>

          <meta charset="UTF-8" />

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />

          <title>${subject}</title>

        </head>


        <body
          style="
            margin:0;
            padding:0;
            background:#f6f7f9;
            font-family:Arial,Helvetica,sans-serif;
          "
        >

          <div
            style="
              max-width:520px;
              margin:0 auto;
              padding:40px 20px;
            "
          >

            <div
              style="
                background:#ffffff;
                border-radius:12px;
                padding:40px 30px;
              "
            >

              <h2
                style="
                  margin:0 0 20px;
                  color:#111111;
                  font-size:24px;
                "
              >
                ${title}
              </h2>


              <p
                style="
                  margin:0 0 24px;
                  color:#555555;
                  font-size:15px;
                  line-height:1.6;
                "
              >
                ${description}
              </p>


              <div
                style="
                  margin:30px 0;
                  padding:24px;
                  background:#f5f5f5;
                  text-align:center;
                  border-radius:10px;
                "
              >

                <div
                  style="
                    margin-bottom:8px;
                    color:#777777;
                    font-size:12px;
                    text-transform:uppercase;
                    letter-spacing:1px;
                  "
                >
                  Verification code
                </div>


                <div
                  style="
                    color:#111111;
                    font-size:32px;
                    font-weight:700;
                    letter-spacing:8px;
                  "
                >
                  ${otp}
                </div>

              </div>


              <p
                style="
                  margin:0 0 16px;
                  color:#555555;
                  font-size:14px;
                  line-height:1.6;
                "
              >
                This code expires in
                <strong>10 minutes</strong>.
              </p>


              <p
                style="
                  margin:0;
                  color:#777777;
                  font-size:13px;
                  line-height:1.6;
                "
              >
                If you did not request this code,
                you can safely ignore this email.
              </p>

            </div>


            <p
              style="
                margin:20px 0 0;
                text-align:center;
                color:#999999;
                font-size:12px;
              "
            >
              AI Commerce
            </p>

          </div>

        </body>

      </html>

    `,


    text:
      `${title}\n\n` +
      `${description}\n\n` +
      `Your verification code is: ${otp}\n\n` +
      `This code expires in 10 minutes.\n\n` +
      `If you did not request this code, you can safely ignore this email.`

  }

}


/*
================================
SEND OTP EMAIL
================================
*/

async function sendOtpEmail({
  email,
  otp,
  purpose
}) {

  if (!email) {

    throw new Error(
      "Email address is required"
    )

  }


  if (!otp) {

    throw new Error(
      "OTP is required"
    )

  }


  if (!process.env.RESEND_API_KEY) {

    throw new Error(
      "RESEND_API_KEY is not configured"
    )

  }


  const normalizedEmail =
    String(email)
      .trim()
      .toLowerCase()


  const normalizedPurpose =
    purpose === "signup"
      ? "signup"
      : "signin"


  const {
    subject,
    html,
    text
  } =
    getOtpEmailContent({

      otp,

      purpose:
        normalizedPurpose

    })


  try {

    const {
      data,
      error
    } =
      await resend.emails.send({

        from:
          getEmailFrom(),

        to:
          [normalizedEmail],

        subject,

        html,

        text

      })


    if (error) {

      console.error(
        "❌ Resend email error:",
        error
      )

      throw new Error(
        error.message ||
        "Failed to send verification email"
      )

    }


    console.log(
      `✅ OTP email sent to ${normalizedEmail}`
    )


    return {

      success: true,

      messageId:
        data?.id || null

    }

  } catch (error) {

    console.error(
      "❌ Failed to send OTP email:",
      error
    )

    throw new Error(
      error.message ||
      "Failed to send verification email"
    )

  }

}


/*
================================
VERIFY RESEND CONFIGURATION
================================
*/

async function verifyEmailTransport() {

  if (!process.env.RESEND_API_KEY) {

    console.error(
      "❌ RESEND_API_KEY is not configured"
    )

    return false

  }


  console.log(
    "✅ Resend email service configured"
  )


  return true

}


/*
================================
EXPORTS
================================
*/

module.exports = {

  sendOtpEmail,

  verifyEmailTransport

}