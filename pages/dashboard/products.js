import {useEffect,useState} from "react"

import DashboardLayout from "../../components/layout/DashboardLayout"

import ProductsTable from "../../components/tables/ProductsTable"

import AddProductModal from "../../components/cards/AddProductModal"

import {
  getProducts,
  syncWooCommerce,
  syncShopify
} from "../../services/productService"

export default function Products(){

  const [products,setProducts] = useState([])
  const [showModal,setShowModal] = useState(false)

  async function load(){

    const data = await getProducts()
    setProducts(data)

  }

  useEffect(()=>{

    load()

  },[])

  async function syncWoo(){

    await syncWooCommerce({
      store_url:"",
      consumer_key:"",
      consumer_secret:""
    })

    load()

  }

  async function syncShop(){

    await syncShopify({
      shop:"",
      access_token:""
    })

    load()

  }

  return(

    <DashboardLayout>

      <div className="flex justify-between items-center mb-6">

        <h1 className="text-2xl font-bold">
          Products
        </h1>

        <div className="flex gap-3">

          <button
            onClick={()=>setShowModal(true)}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Add Product
          </button>

          <button
            onClick={syncWoo}
            className="border px-4 py-2 rounded"
          >
            Sync WooCommerce
          </button>

          <button
            onClick={syncShop}
            className="border px-4 py-2 rounded"
          >
            Sync Shopify
          </button>

        </div>

      </div>

      <ProductsTable products={products}/>

      {showModal &&
        <AddProductModal
          close={()=>setShowModal(false)}
          reload={load}
        />
      }

    </DashboardLayout>

  )

}