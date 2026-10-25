import {
  useEffect,
  useState
} from "react"

import {
  useRouter
} from "next/router"

import API from "../services/api"

import useGuest from "../hooks/useGuest"


/*
|--------------------------------------------------------------------------
| BRAND POINT
|--------------------------------------------------------------------------
*/

function BrandPoint({
  children
}) {

  return (

    <div
      className="
        flex
        items-center
        gap-3
      "
    >

      <span
        className="
          w-5
          h-5
          rounded-full
          bg-[#F2C94C]
          flex
          items-center
          justify-center
          text-[#171713]
          text-xs
          font-bold
          shrink-0
        "
      >
        ✓
      </span>


      <span
        className="
          text-sm
          text-[#77756C]
        "
      >
        {children}
      </span>

    </div>

  )

}


/*
|--------------------------------------------------------------------------
| SHOPIFY ICON
|--------------------------------------------------------------------------
*/

function ShopifyIcon() {

  return (

    <svg
      width="18"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >

      <path
        d="M15.5 5.2c-.2-.2-.5-.3-.8-.3h-.6c-.3-1.5-1.1-3.1-2.7-3.1-1.6 0-2.5 1.4-2.9 2.6-1.1.1-2.1.4-2.8.7-.2.1-.3.3-.4.6L3.1 19.8c-.1.4.2.7.5.8l10.9 2.1c.2 0 .5-.1.6-.3l3.8-15.8c.1-.5 0-1-.4-1.4l-3-2.2Z"
        fill="#171713"
      />

      <path
        d="M11.2 4.4c.3-.9.8-1.8 1.7-1.8.7 0 1.2.8 1.4 1.8h-3.1Z"
        fill="#F7F5EF"
      />

      <path
        d="M9.5 10.4c0-1.3 1.2-1.9 2.2-1.9 1.1 0 2 .3 2.8.8l.7-2.7c-.8-.4-1.8-.7-2.9-.7-3 0-5.1 1.8-5.1 4.4 0 4 5.5 4 5.5 6.1 0 .7-.6 1.2-1.6 1.2-1.3 0-2.7-.5-3.6-1.1l-.7 2.8c.9.6 2.5 1.1 4.1 1.1 3.1 0 5.2-1.8 5.2-4.5-.1-4.2-5.5-4.1-5.5-5.5Z"
        fill="#F7F5EF"
      />

    </svg>

  )

}


/*
|--------------------------------------------------------------------------
| REGISTER
|--------------------------------------------------------------------------
*/

export default function Register() {

  useGuest()

  const router = useRouter()


  /*
  --------------------------------
  AUTH STATE
  --------------------------------
  */

  const [
    name,
    setName
  ] = useState("")


  const [
    email,
    setEmail
  ] = useState("")


  const [
    otp,
    setOtp
  ] = useState("")


  const [
    step,
    setStep
  ] = useState("details")


  const [
    loading,
    setLoading
  ] = useState(false)


  const [
    shopifyLoading,
    setShopifyLoading
  ] = useState(false)


  const [
    resending,
    setResending
  ] = useState(false)


  const [
    error,
    setError
  ] = useState("")


  const [
    message,
    setMessage
  ] = useState("")


  const [
    countdown,
    setCountdown
  ] = useState(0)


  /*
  ========================================
  RESEND COUNTDOWN
  ========================================
  */

  useEffect(() => {

    if (countdown <= 0) {
      return
    }


    const timer = setInterval(() => {

      setCountdown((current) => {

        if (current <= 1) {

          clearInterval(timer)

          return 0

        }


        return current - 1

      })

    }, 1000)


    return () =>
      clearInterval(timer)

  }, [countdown])


  /*
  ========================================
  SHOPIFY
  ========================================

  Shopify-first merchants should not
  have to create a second Guava account
  with email before using their Shopify
  identity.

  Shopify authentication establishes
  the merchant identity. The Guava
  identity layer then determines whether
  the Shopify merchant already has an
  account or needs one created/linked.

  ========================================
  */

  function handleShopifySignup() {

    try {

      setShopifyLoading(true)

      setError("")


      const shopifyAppUrl =
        process.env.NEXT_PUBLIC_SHOPIFY_APP_URL


      if (!shopifyAppUrl) {

        throw new Error(
          "Shopify signup is not configured."
        )

      }


      const returnTo =
        `${window.location.origin}/dashboard`


      const url =
        new URL(
          "/auth/login",
          shopifyAppUrl
        )


      url.searchParams.set(
        "returnTo",
        returnTo
      )


      window.location.href =
        url.toString()

    } catch (error) {

      console.error(
        "Shopify signup error:",
        error
      )


      setShopifyLoading(false)

      setError(
        error?.message ||
        "Unable to start Shopify signup. Please try again."
      )

    }

  }


  /*
  ========================================
  SEND SIGNUP OTP
  ========================================
  */

  async function handleSendOtp(
    event
  ) {

    event.preventDefault()


    setError("")

    setMessage("")


    const normalizedName =
      name.trim()


    const normalizedEmail =
      email
        .trim()
        .toLowerCase()


    if (!normalizedName) {

      setError(
        "Enter your name."
      )

      return

    }


    if (!normalizedEmail) {

      setError(
        "Enter your email address."
      )

      return

    }


    try {

      setLoading(true)


      const response =
        await API.post(
          "/auth/send-otp",
          {
            email:
              normalizedEmail,

            purpose:
              "signup"
          }
        )


      setName(
        normalizedName
      )


      setEmail(
        normalizedEmail
      )


      setMessage(
        response.data?.message ||
        "A verification code has been sent to your email."
      )


      setOtp("")

      setCountdown(60)

      setStep("otp")

    } catch (error) {

      console.error(
        "Send signup OTP error:",
        error
      )


      setError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Unable to send verification code. Please try again."
      )

    } finally {

      setLoading(false)

    }

  }


  /*
  ========================================
  VERIFY SIGNUP OTP
  ========================================
  */

  async function handleVerifyOtp(
    event
  ) {

    event.preventDefault()


    setError("")

    setMessage("")


    const normalizedName =
      name.trim()


    const normalizedEmail =
      email
        .trim()
        .toLowerCase()


    const normalizedOtp =
      otp.trim()


    if (!normalizedName) {

      setError(
        "Your name is required."
      )

      setStep("details")

      return

    }


    if (!normalizedEmail) {

      setError(
        "Your email address is required."
      )

      setStep("details")

      return

    }


    if (!/^\d{6}$/.test(
      normalizedOtp
    )) {

      setError(
        "Enter the 6-digit verification code."
      )

      return

    }


    try {

      setLoading(true)


      const response =
        await API.post(
          "/auth/verify-otp",
          {
            email:
              normalizedEmail,

            otp:
              normalizedOtp,

            purpose:
              "signup",

            name:
              normalizedName
          }
        )


      const data =
        response.data


      const token =
        data?.token ||
        data?.accessToken


      if (!token) {

        throw new Error(
          "Account verification succeeded but no authentication token was returned."
        )

      }


      /*
      --------------------------------
      ACCESS TOKEN
      --------------------------------
      */

      localStorage.setItem(
        "token",
        token
      )


      /*
      --------------------------------
      USER
      --------------------------------
      */

      if (data?.user) {

        localStorage.setItem(
          "user",
          JSON.stringify(
            data.user
          )
        )

      }


      /*
      --------------------------------
      STORE
      --------------------------------
      */

      if (data?.store_id) {

        localStorage.setItem(
          "store_id",
          String(
            data.store_id
          )
        )

      } else {

        localStorage.removeItem(
          "store_id"
        )

      }


      /*
      --------------------------------
      DASHBOARD
      --------------------------------
      */

      router.replace(
        "/dashboard"
      )

    } catch (error) {

      console.error(
        "Verify signup OTP error:",
        error
      )


      setError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Invalid or expired verification code."
      )

    } finally {

      setLoading(false)

    }

  }


  /*
  ========================================
  RESEND OTP
  ========================================
  */

  async function handleResendOtp() {

    if (
      countdown > 0 ||
      resending
    ) {

      return

    }


    const normalizedEmail =
      email
        .trim()
        .toLowerCase()


    if (!normalizedEmail) {

      setStep("details")

      return

    }


    try {

      setResending(true)

      setError("")

      setMessage("")


      await API.post(
        "/auth/send-otp",
        {
          email:
            normalizedEmail,

          purpose:
            "signup"
        }
      )


      setOtp("")

      setCountdown(60)


      setMessage(
        "A new verification code has been sent to your email."
      )

    } catch (error) {

      console.error(
        "Resend signup OTP error:",
        error
      )


      setError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Unable to resend verification code."
      )

    } finally {

      setResending(false)

    }

  }


  /*
  ========================================
  CHANGE DETAILS
  ========================================
  */

  function handleChangeDetails() {

    setOtp("")

    setError("")

    setMessage("")

    setStep("details")

  }


  /*
  ========================================
  RENDER
  ========================================
  */

  return (

    <div
      className="
        min-h-screen
        bg-[#F7F5EF]
        text-[#171713]
        flex
        flex-col
      "
    >

      {/*
      =================================
      NAVIGATION
      =================================
      */}

      <header
        className="
          w-full
          px-6
          py-5
          md:px-10
          lg:px-14
        "
      >

        <div
          className="
            max-w-7xl
            mx-auto
            flex
            items-center
            justify-between
          "
        >

          {/*
          --------------------------------
          BRAND
          --------------------------------
          */}

          <button
            type="button"
            onClick={() =>
              router.push("/")
            }
            className="
              flex
              items-center
              gap-3
              group
            "
          >

            <span
              className="
                w-9
                h-9
                rounded-xl
                bg-[#F2C94C]
                flex
                items-center
                justify-center
                text-[#171713]
                font-bold
                text-sm
                shadow-sm
                group-hover:rotate-3
                transition
              "
            >
              G
            </span>


            <span
              className="
                text-lg
                font-semibold
                tracking-tight
              "
            >
              Guava
            </span>

          </button>


          {/*
          --------------------------------
          SIGN IN
          --------------------------------
          */}

          <div
            className="
              flex
              items-center
              gap-3
              text-sm
            "
          >

            <span
              className="
                hidden
                sm:inline
                text-[#77756C]
              "
            >
              Already have an account?
            </span>


            <button
              type="button"
              onClick={() =>
                router.push("/login")
              }
              className="
                text-[#171713]
                font-medium
                hover:text-[#A17A00]
                transition
              "
            >
              Sign in
            </button>

          </div>

        </div>

      </header>


      {/*
      =================================
      MAIN
      =================================
      */}

      <main
        className="
          flex-1
          flex
          items-center
          px-6
          py-10
          md:px-10
          lg:px-14
        "
      >

        <div
          className="
            max-w-7xl
            w-full
            mx-auto
            grid
            grid-cols-1
            lg:grid-cols-2
            gap-12
            lg:gap-20
            items-center
          "
        >

          {/*
          =================================
          LEFT — BRAND MESSAGE
          =================================
          */}

          <section
            className="
              hidden
              lg:block
              max-w-xl
            "
          >

            <div
              className="
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                border-[#E6DDBF]
                bg-[#FBF9F1]
                px-3
                py-1.5
                mb-7
              "
            >

              <span
                className="
                  w-1.5
                  h-1.5
                  rounded-full
                  bg-[#D6A900]
                "
              />


              <span
                className="
                  text-xs
                  font-medium
                  tracking-wide
                  text-[#77756C]
                "
              >
                INTELLIGENT COMMERCE
              </span>

            </div>


            <h1
              className="
                text-5xl
                xl:text-6xl
                font-semibold
                tracking-[-0.04em]
                leading-[1.05]
              "
            >

              Your business

              <br />

              should feel

              <br />

              <span
                className="
                  text-[#B58A00]
                "
              >
                effortless.
              </span>

            </h1>


            <p
              className="
                mt-7
                text-lg
                leading-8
                text-[#77756C]
                max-w-lg
              "
            >
              Guava brings your commerce
              operations, customer
              conversations, orders and
              intelligence into one calm
              command center.
            </p>


            <div
              className="
                mt-10
                space-y-4
              "
            >

              <BrandPoint>
                One place to understand
                your commerce.
              </BrandPoint>


              <BrandPoint>
                AI that works alongside
                your business.
              </BrandPoint>


              <BrandPoint>
                Your stores stay yours.
              </BrandPoint>


              <BrandPoint>
                Your data stays connected.
              </BrandPoint>

            </div>

          </section>


          {/*
          =================================
          RIGHT — REGISTER
          =================================
          */}

          <section
            className="
              w-full
              max-w-md
              mx-auto
              lg:mx-0
              lg:ml-auto
            "
          >

            {/*
            --------------------------------
            MOBILE BRAND MESSAGE
            --------------------------------
            */}

            <div
              className="
                lg:hidden
                mb-8
              "
            >

              <p
                className="
                  text-sm
                  font-medium
                  text-[#A17A00]
                  mb-3
                "
              >
                GUAVA
              </p>


              <h1
                className="
                  text-4xl
                  font-semibold
                  tracking-[-0.04em]
                  leading-tight
                "
              >
                Commerce,
                <br />
                made calmer.
              </h1>

            </div>


            {/*
            --------------------------------
            CARD
            --------------------------------
            */}

            <div
              className="
                bg-white
                border
                border-[#E9E5D8]
                rounded-[28px]
                p-7
                sm:p-9
                shadow-[0_20px_70px_rgba(40,35,15,0.08)]
              "
            >

              {/*
              --------------------------------
              HEADER
              --------------------------------
              */}

              <div
                className="
                  mb-7
                "
              >

                <h2
                  className="
                    text-2xl
                    font-semibold
                    tracking-tight
                  "
                >
                  {step === "details"
                    ? "Create your account"
                    : "Check your email"
                  }
                </h2>


                <p
                  className="
                    mt-2
                    text-sm
                    leading-6
                    text-[#89877E]
                  "
                >

                  {step === "details"
                    ? "Create your Guava account and get started."
                    : (
                      <>
                        We sent a 6-digit
                        verification code
                        {" "}
                        to{" "}

                        <span
                          className="
                            font-medium
                            text-[#45433C]
                          "
                        >
                          {email}
                        </span>
                      </>
                    )
                  }

                </p>

              </div>


              {/*
              --------------------------------
              ERROR
              --------------------------------
              */}

              {error && (

                <div
                  className="
                    mb-5
                    rounded-xl
                    border
                    border-red-200
                    bg-red-50
                    px-4
                    py-3
                    text-sm
                    leading-5
                    text-red-600
                  "
                >
                  {error}
                </div>

              )}


              {/*
              --------------------------------
              MESSAGE
              --------------------------------
              */}

              {message && (

                <div
                  className="
                    mb-5
                    rounded-xl
                    border
                    border-[#E6DDBF]
                    bg-[#FBF9F1]
                    px-4
                    py-3
                    text-sm
                    leading-5
                    text-[#806100]
                  "
                >
                  {message}
                </div>

              )}


              {/*
              =================================
              SHOPIFY
              =================================
              */}

              {step === "details" && (

                <>

                  <button
                    type="button"
                    onClick={
                      handleShopifySignup
                    }
                    disabled={
                      loading ||
                      shopifyLoading
                    }
                    className="
                      w-full
                      h-12
                      rounded-xl
                      border
                      border-[#D8D4C8]
                      bg-white
                      text-[#171713]
                      font-semibold
                      flex
                      items-center
                      justify-center
                      gap-3
                      hover:bg-[#F8F7F2]
                      active:bg-[#F1EFE7]
                      transition
                      disabled:opacity-50
                      disabled:cursor-not-allowed
                    "
                  >

                    <ShopifyIcon />

                    {shopifyLoading
                      ? "Connecting to Shopify..."
                      : "Continue with Shopify"
                    }

                  </button>


                  <div
                    className="
                      flex
                      items-center
                      gap-4
                      my-6
                    "
                  >

                    <div
                      className="
                        h-px
                        flex-1
                        bg-[#E9E5D8]
                      "
                    />


                    <span
                      className="
                        text-xs
                        font-medium
                        text-[#AAA79C]
                        uppercase
                        tracking-wider
                      "
                    >
                      or
                    </span>


                    <div
                      className="
                        h-px
                        flex-1
                        bg-[#E9E5D8]
                      "
                    />

                  </div>

                </>

              )}


              {/*
              =================================
              DETAILS STEP
              =================================
              */}

              {step === "details" && (

                <form
                  onSubmit={
                    handleSendOtp
                  }
                >

                  {/*
                  --------------------------------
                  NAME
                  --------------------------------
                  */}

                  <div
                    className="
                      mb-4
                    "
                  >

                    <label
                      htmlFor="name"
                      className="
                        block
                        text-sm
                        font-medium
                        text-[#45433C]
                        mb-2
                      "
                    >
                      Full name
                    </label>


                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      autoFocus
                      placeholder="Your name"
                      value={name}
                      onChange={
                        (event) =>
                          setName(
                            event.target.value
                          )
                      }
                      disabled={
                        loading ||
                        shopifyLoading
                      }
                      className="
                        w-full
                        h-12
                        rounded-xl
                        border
                        border-[#DDD9CC]
                        bg-[#FCFBF8]
                        px-4
                        text-sm
                        text-[#171713]
                        outline-none
                        transition
                        placeholder:text-[#A8A49A]
                        focus:border-[#F2C94C]
                        focus:ring-2
                        focus:ring-[#F2C94C]/20
                        disabled:opacity-60
                      "
                    />

                  </div>


                  {/*
                  --------------------------------
                  EMAIL
                  --------------------------------
                  */}

                  <div
                    className="
                      mb-5
                    "
                  >

                    <label
                      htmlFor="email"
                      className="
                        block
                        text-sm
                        font-medium
                        text-[#45433C]
                        mb-2
                      "
                    >
                      Email address
                    </label>


                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={
                        (event) =>
                          setEmail(
                            event.target.value
                          )
                      }
                      disabled={
                        loading ||
                        shopifyLoading
                      }
                      className="
                        w-full
                        h-12
                        rounded-xl
                        border
                        border-[#DDD9CC]
                        bg-[#FCFBF8]
                        px-4
                        text-sm
                        text-[#171713]
                        outline-none
                        transition
                        placeholder:text-[#A8A49A]
                        focus:border-[#F2C94C]
                        focus:ring-2
                        focus:ring-[#F2C94C]/20
                        disabled:opacity-60
                      "
                    />

                  </div>


                  {/*
                  --------------------------------
                  TERMS
                  --------------------------------
                  */}

                  <p
                    className="
                      text-xs
                      leading-5
                      text-[#99968C]
                      mb-5
                    "
                  >
                    By creating an account,
                    you agree to use Guava
                    responsibly and in accordance
                    with our terms and policies.
                  </p>


                  {/*
                  --------------------------------
                  SUBMIT
                  --------------------------------
                  */}

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      shopifyLoading
                    }
                    className="
                      w-full
                      h-12
                      rounded-xl
                      bg-[#F2C94C]
                      text-[#171713]
                      font-semibold
                      hover:bg-[#E8BE3F]
                      active:bg-[#DDB335]
                      shadow-sm
                      transition
                      disabled:opacity-50
                      disabled:cursor-not-allowed
                    "
                  >
                    {loading
                      ? "Sending code..."
                      : "Continue with email"
                    }
                  </button>

                </form>

              )}


              {/*
              =================================
              OTP STEP
              =================================
              */}

              {step === "otp" && (

                <form
                  onSubmit={
                    handleVerifyOtp
                  }
                >

                  <div
                    className="
                      mb-5
                    "
                  >

                    <label
                      htmlFor="otp"
                      className="
                        block
                        text-sm
                        font-medium
                        text-[#45433C]
                        mb-2
                      "
                    >
                      Verification code
                    </label>


                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={6}
                      placeholder="000000"
                      value={otp}
                      onChange={
                        (event) =>
                          setOtp(
                            event.target.value
                              .replace(
                                /\D/g,
                                ""
                              )
                              .slice(
                                0,
                                6
                              )
                          )
                      }
                      disabled={
                        loading
                      }
                      className="
                        w-full
                        h-12
                        rounded-xl
                        border
                        border-[#DDD9CC]
                        bg-[#FCFBF8]
                        px-4
                        text-center
                        text-lg
                        font-semibold
                        tracking-[0.35em]
                        text-[#171713]
                        outline-none
                        transition
                        placeholder:text-[#B8B3A7]
                        placeholder:tracking-[0.35em]
                        focus:border-[#F2C94C]
                        focus:ring-2
                        focus:ring-[#F2C94C]/20
                        disabled:opacity-60
                      "
                    />

                  </div>


                  {/*
                  --------------------------------
                  VERIFY
                  --------------------------------
                  */}

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      otp.length !== 6
                    }
                    className="
                      w-full
                      h-12
                      rounded-xl
                      bg-[#F2C94C]
                      text-[#171713]
                      font-semibold
                      hover:bg-[#E8BE3F]
                      active:bg-[#DDB335]
                      shadow-sm
                      transition
                      disabled:opacity-50
                      disabled:cursor-not-allowed
                    "
                  >
                    {loading
                      ? "Creating account..."
                      : "Create account"
                    }
                  </button>


                  {/*
                  --------------------------------
                  CHANGE DETAILS
                  --------------------------------
                  */}

                  <button
                    type="button"
                    onClick={
                      handleChangeDetails
                    }
                    disabled={
                      loading
                    }
                    className="
                      w-full
                      mt-4
                      text-sm
                      text-[#77756C]
                      hover:text-[#171713]
                      transition
                    "
                  >
                    Change details
                  </button>


                  {/*
                  --------------------------------
                  RESEND
                  --------------------------------
                  */}

                  <div
                    className="
                      mt-6
                      text-center
                    "
                  >

                    <p
                      className="
                        text-xs
                        text-[#99968C]
                      "
                    >
                      Didn't receive the code?
                    </p>


                    <button
                      type="button"
                      onClick={
                        handleResendOtp
                      }
                      disabled={
                        resending ||
                        countdown > 0
                      }
                      className="
                        mt-2
                        text-sm
                        font-medium
                        text-[#A17A00]
                        hover:text-[#806100]
                        transition
                        disabled:opacity-50
                      "
                    >
                      {resending
                        ? "Sending..."
                        : countdown > 0
                          ? `Resend in ${countdown}s`
                          : "Resend code"
                      }
                    </button>

                  </div>

                </form>

              )}

            </div>


            {/*
            --------------------------------
            LOGIN
            --------------------------------
            */}

            <p
              className="
                text-center
                text-sm
                text-[#89877E]
                mt-6
              "
            >
              Already have an account?

              {" "}

              <button
                type="button"
                onClick={() =>
                  router.push("/login")
                }
                className="
                  font-medium
                  text-[#171713]
                  hover:text-[#A17A00]
                  transition
                "
              >
                Sign in
              </button>

            </p>

          </section>

        </div>

      </main>


      {/*
      =================================
      FOOTER
      =================================
      */}

      <footer
        className="
          px-6
          py-6
          md:px-10
          lg:px-14
        "
      >

        <div
          className="
            max-w-7xl
            mx-auto
            flex
            items-center
            justify-between
            text-xs
            text-[#AAA79C]
          "
        >

          <span>
            © {new Date().getFullYear()} Guava
          </span>


          <span>
            Intelligent commerce infrastructure
          </span>

        </div>

      </footer>

    </div>

  )

}