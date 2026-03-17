export default function AuthLayout({ children }){

  return(

    <div className="gradient-bg min-h-screen flex items-center justify-center">

      <div className="glass-card p-10 w-full max-w-md">

        <div className="text-center mb-8">

          <h1 className="text-2xl font-bold">
            WhatsApp Commerce
          </h1>

          <p className="text-muted text-sm mt-1">
            AI powered WhatsApp sales automation
          </p>

        </div>

        {children}

      </div>

    </div>

  )

}