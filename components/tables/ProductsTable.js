export default function ProductsTable({products}){

  return(

    <div className="bg-white rounded shadow overflow-x-auto">

      <table className="w-full text-left">

        <thead className="border-b">

          <tr className="text-gray-600 text-sm">

            <th className="p-4">Product</th>
            <th className="p-4">Price</th>
            <th className="p-4">Stock</th>
            <th className="p-4">Source</th>
            <th className="p-4">Date</th>

          </tr>

        </thead>

        <tbody>

          {products.map(product => (

            <tr key={product._id} className="border-b hover:bg-gray-50">

              <td className="p-4 font-medium">
                {product.name}
              </td>

              <td className="p-4">
                ₦{product.price}
              </td>

              <td className="p-4">
                {product.stock}
              </td>

              <td className="p-4">

                {product.source === "woocommerce" && "WooCommerce"}
                {product.source === "shopify" && "Shopify"}
                {product.source === "manual" && "Manual"}

              </td>

              <td className="p-4">
                {new Date(product.created_at).toLocaleDateString()}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  )

}