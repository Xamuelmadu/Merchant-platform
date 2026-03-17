import { useEffect, useState } from "react"

export default function useAuth(){

  const [loading,setLoading] = useState(true)

  useEffect(()=>{

    const token = localStorage.getItem("token")

    if(!token){
      window.location.href="/login"
      return
    }

    setLoading(false)

  },[])

  return loading

}