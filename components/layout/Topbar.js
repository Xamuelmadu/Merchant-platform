import { useRouter } from "next/router"
import { LogOut } from "lucide-react"

export default function Topbar(){

  const router = useRouter()

  function logout(){

    // remove auth token
    localStorage.removeItem("token")

    // redirect to login
    router.push("/login")

  }

  return(

    <header className="flex justify-between items-center bg-white border-b px-6 py-4">

      {/* PAGE TITLE */}
      <h2 className="text-lg font-semibold">
        Dashboard
      </h2>


      {/* RIGHT SIDE */}
      <div className="flex items-center gap-6">

        {/* USER */}
        <div className="text-sm text-gray-600">
          Admin
        </div>

        {/* LOGOUT BUTTON */}
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700"
        >
          <LogOut size={16}/>
          Logout
        </button>

      </div>

    </header>

  )

}