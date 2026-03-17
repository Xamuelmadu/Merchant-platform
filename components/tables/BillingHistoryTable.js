export default function BillingHistoryTable({invoices}){

  return(

    <div className="bg-white rounded shadow mt-6">

      <table className="w-full text-left">

        <thead className="border-b">

          <tr className="text-gray-600 text-sm">

            <th className="p-4">Invoice</th>
            <th className="p-4">Subscription</th>
            <th className="p-4">Transaction Fees</th>
            <th className="p-4">Total</th>
            <th className="p-4">Status</th>
            <th className="p-4">Date</th>

          </tr>

        </thead>

        <tbody>

          {invoices.map(inv => (

            <tr key={inv._id} className="border-b">

              <td className="p-4">
                {inv._id.slice(-6)}
              </td>

              <td className="p-4">
                ₦{inv.subscription_fee}
              </td>

              <td className="p-4">
                ₦{inv.transaction_fees}
              </td>

              <td className="p-4 font-bold">
                ₦{inv.total_due}
              </td>

              <td className="p-4">
                {inv.status}
              </td>

              <td className="p-4">
                {new Date(inv.created_at).toLocaleDateString()}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  )

}