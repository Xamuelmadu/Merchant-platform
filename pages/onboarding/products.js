import { useState } from "react"
import API from "../../services/api"
import OnboardingLayout from "../../components/layout/OnboardingLayout"

export default function ProductImport(){

  const [storeUrl,setStoreUrl] = useState("")
  const [key,setKey] = useState("")
  const [secret,setSecret] = useState("")

  const [shop,setShop] = useState("")
  const [token,setToken] = useState("")

  const [file,setFile] = useState(null)

  const [loading,setLoading] = useState(false)
  const [error,setError] = useState("")


  async function syncWoo(){

    try{

      setLoading(true)
      setError("")

      await API.post("/products/sync-woocommerce",{

        store_url:storeUrl,
        consumer_key:key,
        consumer_secret:secret

      })

      window.location="/onboarding/finish"

    }catch(err){

      setError("WooCommerce sync failed")

    }

    setLoading(false)

  }



  async function syncShopify(){

    try{

      setLoading(true)
      setError("")

      await API.post("/products/sync-shopify",{

        shop,
        access_token:token

      })

      window.location="/onboarding/finish"

    }catch(err){

      setError("Shopify sync failed")

    }

    setLoading(false)

  }



  async function uploadCSV(){

    if(!file){
      setError("Please select a CSV file")
      return
    }

    try{

      setLoading(true)
      setError("")

      const form = new FormData()

      form.append("file",file)

      await API.post("/products/import-csv",form)

      window.location="/onboarding/finish"

    }catch(err){

      setError("CSV upload failed")

    }

    setLoading(false)

  }



  return(

    <OnboardingLayout step={4}>

      <h1 className="text-2xl font-bold mb-2">
        Import Products
      </h1>

      <p className="text-gray-600 mb-8">
        Add products so your AI assistant can sell them on WhatsApp.
      </p>


      {error && (
        <p className="text-red-500 text-sm mb-6">
          {error}
        </p>
      )}



      {/* WooCommerce */}

      <div className="mb-10">

        <h2 className="font-semibold mb-3">
          WooCommerce
        </h2>

        <input
          placeholder="Store URL"
          className="w-full border p-3 rounded-lg mb-3"
          onChange={(e)=>setStoreUrl(e.target.value)}
        />

        <input
          placeholder="Consumer Key"
          className="w-full border p-3 rounded-lg mb-3"
          onChange={(e)=>setKey(e.target.value)}
        />

        <input
          placeholder="Consumer Secret"
          className="w-full border p-3 rounded-lg mb-4"
          onChange={(e)=>setSecret(e.target.value)}
        />

        <button
          onClick={syncWoo}
          disabled={loading}
          className="bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800"
        >

          Sync WooCommerce

        </button>

      </div>



      {/* Shopify */}

      <div className="mb-10">

        <h2 className="font-semibold mb-3">
          Shopify
        </h2>

        <input
          placeholder="Shop Domain (mystore.myshopify.com)"
          className="w-full border p-3 rounded-lg mb-3"
          onChange={(e)=>setShop(e.target.value)}
        />

        <input
          placeholder="Access Token"
          className="w-full border p-3 rounded-lg mb-4"
          onChange={(e)=>setToken(e.target.value)}
        />

        <button
          onClick={syncShopify}
          disabled={loading}
          className="bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800"
        >

          Sync Shopify

        </button>

      </div>



      {/* CSV */}

      <div>

        <h2 className="font-semibold mb-3">
          Upload CSV
        </h2>

        <input
          type="file"
          className="w-full border p-3 rounded-lg mb-4"
          onChange={(e)=>setFile(e.target.files[0])}
        />

        <button
          onClick={uploadCSV}
          disabled={loading}
          className="bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800"
        >

          Upload CSV

        </button>

      </div>



      <div className="mt-10 text-center">

        <a
          href="/onboarding/finish"
          className="text-gray-500 underline text-sm"
        >
          Skip for now
        </a>

      </div>

    </OnboardingLayout>

  )

}