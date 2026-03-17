import { useState } from "react"
import API from "../../services/api"
import OnboardingLayout from "../../components/layout/OnboardingLayout"

export default function WhatsAppSetup(){

  const [number,setNumber] = useState("")
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState("")

  async function submit(){

    if(!number){
      setError("WhatsApp number is required")
      return
    }

    try{

      setLoading(true)
      setError("")

      await API.post("/store/connect-whatsapp",{
        whatsapp_number:number
      })

      window.location="/onboarding/payments"

    }catch(err){

      setError("Unable to connect WhatsApp")

    }

    setLoading(false)

  }

  return(

    <OnboardingLayout step={2}>

      <h1 className="text-2xl font-bold mb-2">
        Connect WhatsApp
      </h1>

      <p className="text-gray-600 mb-6">
        Enter the WhatsApp number customers will message to place orders.
      </p>

      {error && (
        <p className="text-red-500 text-sm mb-4">
          {error}
        </p>
      )}

      <input
        className="w-full border p-3 rounded-lg mb-6"
        placeholder="2348012345678"
        value={number}
        onChange={(e)=>setNumber(e.target.value)}
      />

      <button
        onClick={submit}
        disabled={loading}
        className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
      >

        {loading ? "Connecting..." : "Continue"}

      </button>

    </OnboardingLayout>

  )

}