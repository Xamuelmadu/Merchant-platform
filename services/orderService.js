import API from "./api"

export const getOrders = async () => {

  try{

    const res = await API.get("/orders")

    return res.data

  }catch(error){

    console.error("Get orders error:", error)

    throw new Error(
      error.response?.data?.error ||
      "Unable to load orders"
    )

  }

}