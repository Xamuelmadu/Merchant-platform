"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

const headlines = [
  "Your AI Sales Rep",
  "Your 24/7 WhatsApp Store",
  "An Automated Checkout Bot",
  "Your AI Commerce Assistant"
]

export default function Home(){

  const [headlineIndex,setHeadlineIndex] = useState(0)

  useEffect(()=>{

    const interval = setInterval(()=>{
      setHeadlineIndex((prev)=>(prev+1)%headlines.length)
    },3000)

    return ()=>clearInterval(interval)

  },[])

  return(

    <div className="min-h-screen bg-black text-white">


      {/* NAVBAR */}

      <nav className="max-w-7xl mx-auto flex justify-between items-center px-6 py-6">

        <h1 className="text-xl font-bold">
          WhatsApp Commerce AI
        </h1>

        <div className="flex gap-6 items-center">

          <Link href="/pricing" className="text-gray-300 hover:text-white">
            Pricing
          </Link>

          <Link href="/login" className="border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-900">
            Login
          </Link>

          <Link
            href="/register"
            className="bg-green-500 text-black px-5 py-2 rounded-lg font-semibold hover:bg-green-400"
          >
            Start Free Trial
          </Link>

        </div>

      </nav>



      {/* HERO */}

      <section className="max-w-7xl mx-auto px-6 pt-24 pb-32 grid md:grid-cols-2 gap-16 items-center">

        {/* LEFT */}

        <div>

          <h1 className="text-6xl font-bold leading-tight mb-6">

            Turn WhatsApp Into  
            <span className="text-green-500 block transition-all duration-500">

              {headlines[headlineIndex]}

            </span>

          </h1>

          <p className="text-gray-400 text-lg mb-10">

            Automatically sell products, respond to customers and
            process payments directly inside WhatsApp using AI.

          </p>

          <div className="flex gap-4">

            <Link
              href="/register"
              className="bg-green-500 text-black px-8 py-4 rounded-xl font-semibold hover:bg-green-400"
            >
              Start Free Trial
            </Link>

            <Link
              href="/pricing"
              className="border border-gray-700 px-8 py-4 rounded-xl hover:bg-gray-900"
            >
              View Pricing
            </Link>

          </div>

          <p className="text-gray-500 text-sm mt-4">
            No credit card required
          </p>

        </div>



        {/* RIGHT — WHATSAPP CHAT DEMO */}

        <ChatDemo/>

      </section>



      {/* FEATURES */}

      <section className="max-w-7xl mx-auto px-6 py-24">

        <h2 className="text-4xl font-bold text-center mb-20">
          Built For AI Commerce
        </h2>

        <div className="grid md:grid-cols-3 gap-10">

          <Feature
            title="AI Sales Assistant"
            desc="AI automatically replies to customers and recommends products."
          />

          <Feature
            title="WhatsApp Checkout"
            desc="Customers complete purchases directly in chat."
          />

          <Feature
            title="Smart Product Sync"
            desc="Import inventory from Shopify, WooCommerce or CSV."
          />

          <Feature
            title="Payment Automation"
            desc="Collect payments using Paystack, Stripe or Flutterwave."
          />

          <Feature
            title="Order Dashboard"
            desc="Track orders, revenue and conversations."
          />

          <Feature
            title="AI Analytics"
            desc="Understand customer behavior and increase conversions."
          />

        </div>

      </section>



      {/* CTA */}

      <section className="text-center py-32 border-t border-gray-800">

        <h2 className="text-4xl font-bold mb-6">
          Launch Your AI Sales Rep Today
        </h2>

        <Link
          href="/register"
          className="bg-green-500 text-black px-10 py-5 rounded-xl font-semibold text-lg hover:bg-green-400"
        >
          Start Free Trial
        </Link>

      </section>


      {/* FOOTER */}

      <footer className="text-center text-gray-500 py-10 text-sm">
        © {new Date().getFullYear()} WhatsApp Commerce AI
      </footer>

    </div>

  )

}



/* FEATURE CARD */

function Feature({title,desc}){

  return(

    <div className="border border-gray-800 p-8 rounded-xl hover:border-green-500 transition">

      <h3 className="font-semibold text-lg mb-3">
        {title}
      </h3>

      <p className="text-gray-400">
        {desc}
      </p>

    </div>

  )

}



/* WHATSAPP CHAT DEMO */

function ChatDemo(){

  const messages = [
    { type:"customer", text:"Hi do you have Nike Air Max?" },
    { type:"ai", text:"Yes! Nike Air Max is available for ₦75,000." },
    { type:"ai", text:"Would you like to order now?" },
    { type:"customer", text:"Yes please" },
    { type:"ai", text:"Great. Checkout here:" },
  ]

  const [visible,setVisible] = useState(1)

  useEffect(()=>{

    const interval = setInterval(()=>{
      setVisible(v => (v < messages.length ? v+1 : 1))
    },2000)

    return ()=>clearInterval(interval)

  },[])

  return(

    <div className="bg-[#0f0f0f] border border-gray-800 rounded-2xl p-6 shadow-2xl w-full max-w-md mx-auto">

      <div className="space-y-4">

        {messages.slice(0,visible).map((m,i)=>(
          <div
            key={i}
            className={`p-3 rounded-xl max-w-[80%] ${
              m.type==="customer"
              ? "bg-green-500 text-black ml-auto"
              : "bg-gray-800 text-white"
            }`}
          >
            {m.text}
          </div>
        ))}

      </div>

    </div>

  )

}