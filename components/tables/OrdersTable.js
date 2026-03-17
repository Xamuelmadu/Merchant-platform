export default function OrdersTable({orders}){

  return(

    <div className="bg-white rounded shadow overflow-x-auto">

      <table className="w-full text-left">

        <thead className="border-b">

          <tr className="text-gray-600 text-sm">

            <th className="p-4">Order ID</th>
            <th className="p-4">Customer</th>
            <th className="p-4">Product</th>
            <th className="p-4">Amount</th>
            <th className="p-4">Platform Fee</th>
            <th className="p-4">Payment</th>
            <th className="p-4">Status</th>
            <th className="p-4">Date</th>

          </tr>

        </thead>

        <tbody>

          {orders.map(order => (

            <tr key={order._id} className="border-b hover:bg-gray-50">

              <td className="p-4">{order._id.slice(-6)}</td>

              <td className="p-4">{order.customer_name}</td>

              <td className="p-4">
                {order.product_id?.name}
              </td>

              <td className="p-4">
                ₦{order.total_price}
              </td>

              <td className="p-4">
                ₦{order.platform_fee}
              </td>

              <td className="p-4">
                {order.payment_status}
              </td>

              <td className="p-4">
                {order.order_status}
              </td>

              <td className="p-4">
                {new Date(order.created_at).toLocaleDateString()}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  )

}