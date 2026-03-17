import {useState} from "react"
import {addProduct} from "../../services/productService"

export default function AddProductModal({close,reload}){

  const [name,setName] = useState("")
  const [price,setPrice] = useState("")
  const [stock,setStock] = useState("")
  const [description,setDescription] = useState("")

  async function submit(){

    await addProduct({
      name,
      price,
      stock,
      description
    })

    reload()
    close()

  }

  return(

    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">

      <div className="bg-white p-6 rounded w-96">

        <h2 className="text-lg font-bold mb-4">
          Add Product
        </h2>

        <input
          placeholder="Product Name"
          className="border p-2 w-full mb-3"
          onChange={(e)=>setName(e.target.value)}
        />

        <input
          placeholder="Price"
          className="border p-2 w-full mb-3"
          onChange={(e)=>setPrice(e.target.value)}
        />

        <input
          placeholder="Stock"
          className="border p-2 w-full mb-3"
          onChange={(e)=>setStock(e.target.value)}
        />

        <textarea
          placeholder="Description"
          className="border p-2 w-full mb-3"
          onChange={(e)=>setDescription(e.target.value)}
        />

        <div className="flex justify-between">

          <button
            onClick={close}
            className="px-4 py-2 border rounded"
          >
            Cancel
          </button>

          <button
            onClick={submit}
            className="px-4 py-2 bg-black text-white rounded"
          >
            Add
          </button>

        </div>

      </div>

    </div>

  )

}