import { useState } from "react"
import API from "../../services/api"
import OnboardingLayout from "../../components/layout/OnboardingLayout"

export default function PaymentSetup(){

  const [paystackSecret,setPaystackSecret] = useState("")
  const [flutterwaveSecret,setFlutterwaveSecret] = useState("")
  const [stripeSecret,setStripeSecret] = useState("")

  const [loading,setLoading] = useState(false)
  const [error,setError] = useState("")


  async function submit(){

    try{

      setLoading(true)
      setError("")

      await API.post("/store/payments",{

        paystack_secret: paystackSecret,
        flutterwave_secret: flutterwaveSecret,
        stripe_secret: stripeSecret

      })

      window.location.href="/onboarding/products"

    }catch(err){

      console.error(err)

      setError(
        err?.response?.data?.error ||
        "Unable to update payments"
      )

    }finally{

      setLoading(false)

    }

  }


  return(

    <OnboardingLayout step={3}>

      <h1 className="text-2xl font-bold mb-2">
        Connect Payment Gateways
      </h1>

      <p className="text-gray-600 mb-6">
        Add your payment gateway keys so customers can pay directly on WhatsApp.
      </p>


      {error && (
        <p className="text-red-500 text-sm mb-4">
          {error}
        </p>
      )}


      <input
        type="password"
        placeholder="Paystack Secret Key"
        className="w-full border p-3 rounded-lg mb-4"
        value={paystackSecret}
        onChange={(e)=>setPaystackSecret(e.target.value)}
      />


      <input
        type="password"
        placeholder="Flutterwave Secret Key"
        className="w-full border p-3 rounded-lg mb-4"
        value={flutterwaveSecret}
        onChange={(e)=>setFlutterwaveSecret(e.target.value)}
      />


      <input
        type="password"
        placeholder="Stripe Secret Key"
        className="w-full border p-3 rounded-lg mb-6"
        value={stripeSecret}
        onChange={(e)=>setStripeSecret(e.target.value)}
      />


      <button
        onClick={submit}
        disabled={loading}
        className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
      >

        {loading ? "Saving..." : "Continue"}

      </button>

    </OnboardingLayout>

  )

}