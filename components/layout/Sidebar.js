import Link from "next/link"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Wallet,
  Plug,
  CreditCard,
  Settings
} from "lucide-react"

export default function Sidebar(){

  return(

    <aside className="w-64 bg-black text-white min-h-screen p-6">

      <h1 className="text-xl font-bold mb-10">
        WhatsApp Commerce
      </h1>

      <nav className="space-y-6">

        <Link href="/dashboard" className="flex items-center gap-2">
          <LayoutDashboard size={18}/>
          Dashboard
        </Link>

        <Link href="/dashboard/orders" className="flex items-center gap-2">
          <ShoppingCart size={18}/>
          Orders
        </Link>

        <Link href="/dashboard/products" className="flex items-center gap-2">
          <Package size={18}/>
          Products
        </Link>

        <Link href="/dashboard/analytics" className="flex items-center gap-2">
          <BarChart3 size={18}/>
          Analytics
        </Link>

        <Link href="/dashboard/financials" className="flex items-center gap-2">
          <Wallet size={18}/>
          Financials
        </Link>

        <Link href="/dashboard/integrations" className="flex items-center gap-2">
          <Plug size={18}/>
          Integrations
        </Link>

        <Link href="/dashboard/payments" className="flex items-center gap-2">
          <CreditCard size={18}/>
          Payments
        </Link>

        <Link href="/dashboard/settings" className="flex items-center gap-2">
          <Settings size={18}/>
          Settings
        </Link>

      </nav>

    </aside>

  )

}