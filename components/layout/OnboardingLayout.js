export default function OnboardingLayout({ step, children }) {

 const steps = [
  "Store",
  "WhatsApp",
  "Payments",
  "Products",
  "Finish"
]

  return (

    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">

      <div className="w-full max-w-2xl">

        {/* STEP PROGRESS */}

        <div className="flex justify-between mb-10">

          {steps.map((s,i)=>{

            const active = step === i + 1
            const complete = step > i + 1

            return (

              <div key={i} className="flex-1 text-center">

                <div
                  className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${
                    active
                    ? "bg-white text-black"
                    : complete
                    ? "bg-green-500 text-black"
                    : "bg-gray-800 text-gray-400"
                  }`}
                >

                  {i + 1}

                </div>

                <p className="text-xs mt-2 text-gray-400">
                  {s}
                </p>

              </div>

            )

          })}

        </div>


        {/* CARD */}

        <div className="bg-white text-black p-10 rounded-xl shadow-xl">

          {children}

        </div>

      </div>

    </div>

  )

}