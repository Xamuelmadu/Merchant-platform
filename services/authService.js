import API from "./api"

export const register = async (data) => {

  try{

    const res = await API.post("/auth/register", data)

    return res.data

  }catch(error){

    console.error("Register error:", error)

    throw error

  }

}

export const login = async (data) => {

  try{

    const res = await API.post("/auth/login", data)

    return res.data

  }catch(error){

    console.error("Login error:", error)

    throw error

  }

}