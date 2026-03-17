import API from "./api"


export const getProducts = async () => {

  try{

    const res = await API.get("/products")

    return res.data

  }catch(error){

    console.error("Get products error:", error)

    throw new Error(
      error.response?.data?.error ||
      "Unable to load products"
    )

  }

}



export const addProduct = async (data) => {

  try{

    const res = await API.post("/products/add", data)

    return res.data

  }catch(error){

    console.error("Add product error:", error)

    throw new Error(
      error.response?.data?.error ||
      "Unable to add product"
    )

  }

}



export const syncWooCommerce = async (data) => {

  try{

    const res = await API.post("/products/sync-woocommerce", data)

    return res.data

  }catch(error){

    console.error("WooCommerce sync error:", error)

    throw new Error(
      error.response?.data?.error ||
      "WooCommerce sync failed"
    )

  }

}



export const syncShopify = async (data) => {

  try{

    const res = await API.post("/products/sync-shopify", data)

    return res.data

  }catch(error){

    console.error("Shopify sync error:", error)

    throw new Error(
      error.response?.data?.error ||
      "Shopify sync failed"
    )

  }

}