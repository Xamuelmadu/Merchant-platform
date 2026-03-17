import { useState } from "react"
import { useRouter } from "next/router"
import { register } from "../services/authService"
import useGuest from "../hooks/useGuest"
import AuthLayout from "../components/layout/AuthLayout"

export default function Register(){

  useGuest()

  const router = useRouter()

  const [name,setName] = useState("")
  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState("")
  const [success,setSuccess] = useState("")

  async function submit(){

    if(!name || !email || !password){
      setError("All fields are required")
      return
    }

    try{

      setLoading(true)
      setError("")

      await register({
        name,
        email,
        password
      })

      setSuccess("Account created. Please login.")

      setTimeout(()=>{
        router.push("/login")
      },1500)

    }catch(err){

      setError(
        err?.response?.data?.error ||
        err?.message ||
        "Registration failed"
      )

    }finally{
      setLoading(false)
    }

  }

  return(

    <AuthLayout>

      <div className="w-full max-w-md mx-auto">

        <h2 className="text-2xl font-bold mb-6 text-center text-white">
          Create Account
        </h2>

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">
            {error}
          </p>
        )}

        {success && (
          <p className="text-green-400 text-sm mb-4 text-center">
            {success}
          </p>
        )}

        <input
          placeholder="Full Name"
          value={name}
          onChange={(e)=>setName(e.target.value)}
          className="mb-3 w-full p-3 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:border-green-400"
        />

        <input
          placeholder="Email Address"
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
          {loading ? "Creating account..." : "Register"}
        </button>

        <p className="text-sm mt-5 text-center text-gray-400">

          Already have an account?

          <a
            href="/login"
            className="text-green-400 ml-1 hover:underline"
          >
            Login
          </a>

        </p>

      </div>

    </AuthLayout>

  )

}