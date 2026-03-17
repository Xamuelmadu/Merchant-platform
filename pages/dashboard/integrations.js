import {useEffect,useState} from "react"

import DashboardLayout from "../../components/layout/DashboardLayout"

import {updatePayments,getPayments} from "../../services/billingService"

export default function Integrations(){

  const [paystack,setPaystack] = useState("")
  const [flutterwave,setFlutterwave] = useState("")
  const [stripe,setStripe] = useState("")

  const [bankName,setBankName] = useState("")
  const [accountNumber,setAccountNumber] = useState("")
  const [accountName,setAccountName] = useState("")

  async function load(){

    const data = await getPayments()

    if(data.paystack) setPaystack(data.paystack.secret_key)
    if(data.flutterwave) setFlutterwave(data.flutterwave.secret_key)
    if(data.stripe) setStripe(data.stripe.secret_key)

  }

  useEffect(()=>{

    load()

  },[])

  async function save(){

    await updatePayments({

      paystack_secret:paystack,
      flutterwave_secret:flutterwave,
      stripe_secret:stripe,

      bank_name:bankName,
      account_number:accountNumber,
      account_name:accountName

    })

    alert("Integrations saved")

  }

  return(

    <DashboardLayout>

      <h1 className="text-2xl font-bold mb-8">
        Integrations
      </h1>

      <div className="grid grid-cols-2 gap-8">

        {/* Payment Gateways */}

        <div className="bg-white p-6 rounded shadow">

          <h2 className="font-bold mb-4">
            Payment Gateways
          </h2>

          <input
            placeholder="Paystack Secret Key"
            className="border p-2 w-full mb-3"
            value={paystack}
            onChange={(e)=>setPaystack(e.target.value)}
          />

          <input
            placeholder="Flutterwave Secret Key"
            className="border p-2 w-full mb-3"
            value={flutterwave}
            onChange={(e)=>setFlutterwave(e.target.value)}
          />

          <input
            placeholder="Stripe Secret Key"
            className="border p-2 w-full mb-3"
            value={stripe}
            onChange={(e)=>setStripe(e.target.value)}
          />

        </div>

        {/* Bank Transfer */}

        <div className="bg-white p-6 rounded shadow">

          <h2 className="font-bold mb-4">
            Bank Transfer
          </h2>

          <input
            placeholder="Bank Name"
            className="border p-2 w-full mb-3"
            onChange={(e)=>setBankName(e.target.value)}
          />

          <input
            placeholder="Account Number"
            className="border p-2 w-full mb-3"
            onChange={(e)=>setAccountNumber(e.target.value)}
          />

          <input
            placeholder="Account Name"
            className="border p-2 w-full mb-3"
            onChange={(e)=>setAccountName(e.target.value)}
          />

        </div>

      </div>

      <button
        onClick={save}
        className="mt-6 bg-black text-white px-6 py-2 rounded"
      >
        Save Integrations
      </button>

    </DashboardLayout>

  )

}