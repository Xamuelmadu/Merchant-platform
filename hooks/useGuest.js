import { useEffect } from "react"

export default function useGuest(){

  useEffect(()=>{

    const token = localStorage.getItem("token")

    if(token){
      window.location="/dashboard"
    }

  },[])

}