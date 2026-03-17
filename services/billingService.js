import API from "./api"


export const updatePayments = async (data) => {

  try{

    const res = await API.post("/integrations/payments/update", data)

    return res.data

  }catch(error){

    console.error("Update payments error:", error)

    throw new Error(
      error.response?.data?.error ||
      "Unable to update payment settings"
    )

  }

}


export const getPayments = async () => {

  try{

    const res = await API.get("/integrations/payments")

    return res.data

  }catch(error){

    console.error("Get payments error:", error)

    throw new Error(
      error.response?.data?.error ||
      "Unable to load payment settings"
    )

  }

}


export const getFinancialSummary = async () => {

  try{

    const res = await API.get("/analytics/financial-summary")

    return res.data

  }catch(error){

    console.error("Financial summary error:", error)

    throw new Error(
      error.response?.data?.error ||
      "Unable to load financial summary"
    )

  }

}


export const getMonthlyInvoice = async () => {

  try{

    const res = await API.get("/billing/invoice")

    return res.data

  }catch(error){

    console.error("Invoice fetch error:", error)

    throw new Error(
      error.response?.data?.error ||
      "Unable to fetch invoice"
    )

  }

}


export const getBillingInfo = async () => {

  try{

    const res = await API.get("/billing")

    return res.data

  }catch(error){

    console.error("Billing info error:", error)

    throw new Error(
      error.response?.data?.error ||
      "Unable to load billing info"
    )

  }

}


export const payInvoice = async () => {

  try{

    const res = await API.post("/billing/pay-invoice")

    return res.data

  }catch(error){

    console.error("Invoice payment error:", error)

    throw new Error(
      error.response?.data?.error ||
      "Invoice payment failed"
    )

  }

}


export const getBillingHistory = async () => {

  try{

    const res = await API.get("/billing/history")

    return res.data

  }catch(error){

    console.error("Billing history error:", error)

    throw new Error(
      error.response?.data?.error ||
      "Unable to load billing history"
    )

  }

}