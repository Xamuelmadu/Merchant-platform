import OnboardingLayout from "../../components/layout/OnboardingLayout"

export default function Finish(){

  return(

    <OnboardingLayout step={5}>

      <div className="text-center">

        <h1 className="text-3xl font-bold mb-4">
          Setup Complete
        </h1>

        <p className="text-gray-600 mb-8">
          Your WhatsApp store has been configured successfully. 
          You can now manage products, conversations and orders 
          from your dashboard.
        </p>

        <a
          href="/dashboard"
          className="inline-block bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
        >
          Go to Dashboard
        </a>

      </div>

    </OnboardingLayout>

  )

}