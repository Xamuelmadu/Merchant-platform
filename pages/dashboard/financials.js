import { useEffect, useState } from "react"

import DashboardLayout from "../../components/layout/DashboardLayout"
import StatCard from "../../components/cards/StatCard"
import TransactionTable from "../../components/tables/TransactionTable"

import {
  getFinancialSummary,
  getMonthlyInvoice
} from "../../services/billingService"

export default function Financials(){

  const [summary,setSummary] = useState(null)
  const [invoice,setInvoice] = useState(null)
  const [orders,setOrders] = useState([])

  useEffect(()=>{

    async function load(){

      try{

        const data = await getFinancialSummary()
        const inv = await getMonthlyInvoice()

        setSummary(data)
        setInvoice(inv)

        // safe fallback
        setOrders(data.orders_list || [])

      }catch(err){

        console.error("Financial load error",err)

      }

    }

    load()

  },[])

  if(!summary) return <DashboardLayout>Loading...</DashboardLayout>

  return(

    <DashboardLayout>

      <h1 className="text-2xl font-bold mb-8">
        Financials
      </h1>

      <div className="grid grid-cols-4 gap-6">

        <StatCard
          title="Revenue"
          value={`₦${summary.revenue}`}
        />

        <StatCard
          title="Platform Fees"
          value={`₦${summary.platform_fees}`}
        />

        <StatCard
          title="Net Earnings"
          value={`₦${summary.net_earnings}`}
        />

        <StatCard
          title="Orders"
          value={summary.orders}
        />

      </div>

      {invoice && (

        <div className="bg-white p-6 rounded shadow mt-8">

          <h2 className="text-lg font-bold mb-4">
            Monthly Invoice
          </h2>

          <p>
            Subscription: ₦{invoice.subscription_fee}
          </p>

          <p>
            Transaction Fees: ₦{invoice.transaction_fees}
          </p>

          <p className="font-bold mt-2">
            Total Due: ₦{invoice.total_due}
          </p>

          <button className="mt-4 bg-black text-white px-6 py-2 rounded">
            Pay Invoice
          </button>

        </div>

      )}

      <TransactionTable orders={orders} />

    </DashboardLayout>

  )

}