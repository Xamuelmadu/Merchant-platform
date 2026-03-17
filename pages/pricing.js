import Link from "next/link"

export default function Pricing(){

  return(

    <div className="min-h-screen bg-gray-50">

      <div className="max-w-6xl mx-auto py-20 px-6">

        <h1 className="text-4xl font-bold text-center mb-6">
          Simple Pricing
        </h1>

        <p className="text-center text-gray-600 mb-14">
          Start your free trial. Upgrade as your business grows.
        </p>


        <div className="grid md:grid-cols-3 gap-10">

          <Plan
            name="Starter"
            price="₦9,500"
            desc="Perfect for small businesses starting on WhatsApp."
            features={[
              "2 weeks free trial",
              "20 free monthly orders",
              "AI WhatsApp assistant",
              "CSV product import",
              "Basic analytics"
            ]}
          />

          <Plan
            name="Growth"
            price="₦24,000"
            highlight={true}
            desc="Best for growing stores handling more customers."
            features={[
              "Unlimited AI conversations",
              "WooCommerce & Shopify sync",
              "WhatsApp checkout",
              "Advanced analytics",
              "Priority support"
            ]}
          />

          <Plan
            name="Scale"
            price="₦55,000"
            desc="For high volume stores and teams."
            features={[
              "Everything in Growth",
              "Multiple agents",
              "Advanced automation",
              "Custom integrations",
              "Dedicated support"
            ]}
          />

        </div>


        <p className="text-center text-gray-600 mt-10">
          Platform fee: 1–2% per transaction depending on volume.
        </p>


        <div className="text-center text-gray-500 mt-6 text-sm">

          ✓ Cancel anytime  
          ✓ No setup fees  
          ✓ Secure payments  

        </div>

      </div>

    </div>

  )

}



function Plan({name,price,desc,features,highlight}){

  return(

    <div className={`card ${highlight ? "border-2 border-black scale-105" : ""}`}>

      {highlight && (
        <div className="text-sm font-semibold mb-3 text-green-600">
          Most Popular
        </div>
      )}

      <h2 className="text-xl font-bold mb-2">
        {name}
      </h2>

      <p className="text-gray-600 mb-4">
        {desc}
      </p>

      <div className="text-3xl font-bold mb-1">
        {price}
      </div>

      <p className="text-gray-500 mb-6 text-sm">
        per month
      </p>

      <ul className="mb-6 space-y-2">

        {features.map((f,i)=>(
          <li key={i}>
            ✓ {f}
          </li>
        ))}

      </ul>

      <Link
        href="/register"
        className="btn-primary block text-center"
      >
        Start Free Trial
      </Link>

    </div>

  )

}