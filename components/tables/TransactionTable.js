export default function TransactionTable({ orders = [] }) {

  return(

    <div className="bg-white rounded shadow overflow-x-auto mt-6">

      <table className="w-full text-left">

        <thead className="border-b">

          <tr className="text-gray-600 text-sm">

            <th className="p-4">Order</th>
            <th className="p-4">Amount</th>
            <th className="p-4">Platform Fee</th>
            <th className="p-4">Net</th>
            <th className="p-4">Date</th>

          </tr>

        </thead>

        <tbody>

          {orders.map(order => (

            <tr key={order._id} className="border-b">

              <td className="p-4">
                {order._id.slice(-6)}
              </td>

              <td className="p-4">
                ₦{order.total_price}
              </td>

              <td className="p-4">
                ₦{order.platform_fee}
              </td>

              <td className="p-4">
                ₦{order.merchant_payout}
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