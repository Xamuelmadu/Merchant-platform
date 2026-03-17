import { useState } from "react"
import API from "../../services/api"

import useAuth from "../../hooks/useAuth"
import OnboardingLayout from "../../components/layout/OnboardingLayout"

export default function StoreSetup(){

  const loadingAuth = useAuth()

  const [name,setName] = useState("")
  const [phone,setPhone] = useState("")
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState("")

async function submit(){

  if(!name || !phone){
    setError("Store name and phone are required")
    return
  }

  try{

    setLoading(true)
    setError("")

    await API.post("/store/create",{
      store_name: name,
      merchant_phone: phone
    })

    window.location.href="/onboarding/whatsapp"

  }catch(err){

    console.error(err)

    setError(
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      "Unable to create store"
    )

  }finally{
    setLoading(false)
  }

}

  if(loadingAuth) return null

  return(

    <OnboardingLayout step={1}>

      <h2 className="text-2xl font-bold mb-2">
        Create Your Store
      </h2>

      <p className="text-gray-600 mb-6">
        Set up your store to begin selling on WhatsApp.
      </p>

      {error && (
        <p className="text-red-500 text-sm mb-4">
          {error}
        </p>
      )}

      <input
        placeholder="Store Name"
        className="mb-4 w-full p-3 border rounded-lg"
        value={name}
        onChange={(e)=>setName(e.target.value)}
      />

      <input
        placeholder="Merchant Phone (234...)"
        className="mb-6 w-full p-3 border rounded-lg"
        value={phone}
        onChange={(e)=>setPhone(e.target.value)}
      />

      <button
        onClick={submit}
        disabled={loading}
        className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800"
      >
        {loading ? "Creating Store..." : "Continue"}
      </button>

    </OnboardingLayout>

  )

}