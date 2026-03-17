import {useEffect,useState} from "react"

import DashboardLayout from "../../components/layout/DashboardLayout"

import OrdersTable from "../../components/tables/OrdersTable"

import {getOrders} from "../../services/orderService"

export default function Orders(){

  const [orders,setOrders] = useState([])

  useEffect(()=>{

    async function load(){

      const data = await getOrders()

      setOrders(data)

    }

    load()

  },[])

  return(

    <DashboardLayout>

      <h1 className="text-2xl font-bold mb-6">
        Orders
      </h1>

      <OrdersTable orders={orders}/>

    </DashboardLayout>

  )

}