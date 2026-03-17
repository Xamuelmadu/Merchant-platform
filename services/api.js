import axios from "axios"

const API = axios.create({

  baseURL: (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000") + "/api",

  timeout:30000,

  headers: {
    "Content-Type": "application/json"
  }

})



/*
--------------------------------
ATTACH JWT TOKEN
--------------------------------
*/

API.interceptors.request.use(

  (config) => {

    if (typeof window !== "undefined") {

      const token = localStorage.getItem("token")

      if (token) {

        config.headers = config.headers || {}

        config.headers.Authorization = `Bearer ${token}`

      }

    }

    return config

  },

  (error) => Promise.reject(error)

)



/*
--------------------------------
GLOBAL RESPONSE HANDLER
--------------------------------
*/

API.interceptors.response.use(

  (response) => response,

  (error) => {

    console.error("API error:", error)

    if (error.response?.status === 401) {

      if (typeof window !== "undefined") {

        localStorage.removeItem("token")

        window.location.href = "/login"

      }

    }

    return Promise.reject(error)

  }

)

export default API