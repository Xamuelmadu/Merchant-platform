import {useEffect,useState} from "react"

import DashboardLayout from "../../components/layout/DashboardLayout"

import BillingHistoryTable from "../../components/tables/BillingHistoryTable"

import {
  getBillingInfo,
  getBillingHistory,
  payInvoice
} from "../../services/billingService"

export default function Payments(){

  const [billing,setBilling] = useState(null)
  const [history,setHistory] = useState([])

  useEffect(()=>{

    async function load(){

      const bill = await getBillingInfo()
      const hist = await getBillingHistory()

      setBilling(bill)
      setHistory(hist)

    }

    load()

  },[])

  async function pay(){

    const res = await payInvoice()

    window.location = res.payment_link

  }

  if(!billing) return <DashboardLayout>Loading...</DashboardLayout>

  return(

    <DashboardLayout>

      <h1 className="text-2xl font-bold mb-8">
        Payments & Billing
      </h1>

      <div className="bg-white p-6 rounded shadow">

        <h2 className="text-lg font-bold mb-4">
          Current Plan
        </h2>

        <p>Plan: {billing.plan}</p>

        <p>Subscription: ₦{billing.subscription_fee}</p>

        <p>Transaction Fees: ₦{billing.transaction_fees}</p>

        <p className="font-bold mt-2">
          Total Due: ₦{billing.total_due}
        </p>

        {billing.total_due > 0 && (

          <button
            onClick={pay}
            className="mt-4 bg-black text-white px-6 py-2 rounded"
          >
            Pay Invoice
          </button>

        )}

      </div>

      <h2 className="text-lg font-bold mt-10">
        Billing History
      </h2>

      <BillingHistoryTable invoices={history}/>

    </DashboardLayout>

  )

}