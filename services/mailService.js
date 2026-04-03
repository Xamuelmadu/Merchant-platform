const nodemailer = require("nodemailer")

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

async function sendOtpEmail(email, otp) {

  await transporter.sendMail({
    from: `"Your App" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Login OTP",
    html: `<h2>Your OTP is: ${otp}</h2><p>Expires in 10 minutes</p>`
  })

}

module.exports = { sendOtpEmail }