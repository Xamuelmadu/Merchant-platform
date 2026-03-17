import { useEffect, useState } from "react"

import DashboardLayout from "../../components/layout/DashboardLayout"
import StatCard from "../../components/cards/StatCard"

import { getFinancialSummary } from "../../services/billingService"

export default function Analytics() {

  const [summary,setSummary] = useState(null)

  useEffect(()=>{

    async function load(){

      const data = await getFinancialSummary()

      setSummary(data)

    }

    load()

  },[])

  if(!summary){
    return <DashboardLayout>Loading...</DashboardLayout>
  }

  return (

    <DashboardLayout>

      <h1 className="text-2xl font-bold mb-8">
        Analytics
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

    </DashboardLayout>

  )

}