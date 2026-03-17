// services/analyticsService.js

import API from "./api"



/*
--------------------------------
GET FINANCIAL SUMMARY
--------------------------------
*/

export const getFinancialSummary = async () => {

  try {

    console.log("Fetching financial summary...")

    const res = await API.get("/analytics/financial-summary")

    console.log("Financial summary response:", res.data)

    return res.data

  } catch (error) {

    console.error("Financial summary error:", error)

    if (error.response) {

      console.error("Server error:", error.response.data)

      throw new Error(
        error.response.data?.error ||
        `Server error: ${error.response.status}`
      )

    }

    if (error.request) {

      console.error("No response from server")

      throw new Error(
        "No response from server. Please check your connection."
      )

    }

    console.error("Request setup error:", error.message)

    throw new Error("Failed to make request.")

  }

}



/*
--------------------------------
GET SALES DATA
--------------------------------
*/

export const getSalesData = async () => {

  try {

    const res = await API.get("/analytics/sales")

    return res.data

  } catch (error) {

    console.error("Sales data error:", error)

    throw error

  }

}