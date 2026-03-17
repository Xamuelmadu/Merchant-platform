import Sidebar from "./Sidebar"
import Topbar from "./Topbar"

export default function DashboardLayout({children}){

  return(

    <div className="flex">

      <Sidebar/>

      <div className="flex-1">

        <Topbar/>

        <main className="p-8 bg-gray-100 min-h-screen">

          {children}

        </main>

      </div>

    </div>

  )

}