import { useState } from "react"
import { useRouter } from "next/router"
import { login } from "../services/authService"
import useGuest from "../hooks/useGuest"
import AuthLayout from "../components/layout/AuthLayout"

export default function Login(){

  useGuest()

  const router = useRouter()

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState("")

  async function submit(){

    if(!email || !password){
      setError("Email and password are required")
      return
    }

    try{

      setLoading(true)
      setError("")

      const res = await login({
        email,
        password
      })

      if(!res?.token){
        throw new Error("Authentication failed")
      }

      localStorage.setItem("token",res.token)

      /*
      ALWAYS START ONBOARDING AFTER LOGIN
      */

      router.push("/onboarding/store")

    }catch(err){

      setError(
        err?.response?.data?.error ||
        err?.message ||
        "Login failed"
      )

    }finally{
      setLoading(false)
    }

  }

  return(

    <AuthLayout>

      <div className="w-full max-w-md mx-auto">

        <h2 className="text-2xl font-bold mb-6 text-center text-white">
          Login
        </h2>

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">
            {error}
          </p>
        )}

        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          className="mb-3 w-full p-3 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:border-green-400"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          className="mb-4 w-full p-3 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:border-green-400"
        />

        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-green-500 text-black py-3 rounded-lg font-semibold hover:bg-green-400 transition disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="text-sm mt-5 text-center text-gray-400">

          Don't have an account?

          <a
            href="/register"
            className="text-green-400 ml-1 hover:underline"
          >
            Register
          </a>

        </p>

      </div>

    </AuthLayout>

  )

}