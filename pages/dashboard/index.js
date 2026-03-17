import { useEffect, useState } from "react"
import DashboardLayout from "../../components/layout/DashboardLayout"
import formatCurrency from "../../utils/formatCurrency"
import StatCard from "../../components/cards/StatCard"
import { getFinancialSummary } from "../../services/analyticsService"
import useAuth from "../../hooks/useAuth"


export default function Dashboard(){

  const loadingAuth = useAuth()

  const [stats,setStats] = useState(null)


  useEffect(()=>{

    async function load(){

      try{

        const data = await getFinancialSummary()

        setStats(data)

      }catch(err){

        console.error("Dashboard stats error:",err)

        setStats({
          revenue:0,
          orders:0,
          platform_fees:0,
          net_earnings:0
        })

      }

    }

    load()

  },[])


  if(loadingAuth || !stats){

    return(

      <DashboardLayout>

        <div className="p-6">Loading...</div>

      </DashboardLayout>

    )

  }


  return(

    <DashboardLayout>

      <h1 className="text-2xl font-bold mb-8">
        Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        <StatCard
          title="Revenue"
          value={formatCurrency(stats.revenue)}
        />

        <StatCard
          title="Orders"
          value={stats.orders}
        />

        <StatCard
          title="Platform Fees"
          value={formatCurrency(stats.platform_fees)}
        />

        <StatCard
          title="Net Earnings"
          value={formatCurrency(stats.net_earnings)}
        />

      </div>

    </DashboardLayout>

  )

}