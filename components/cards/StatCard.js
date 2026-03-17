export default function StatCard({title,value}){

  return(

    <div className="bg-white p-6 rounded-lg shadow">

      <p className="text-gray-500 text-sm mb-2">
        {title}
      </p>

      <h2 className="text-2xl font-bold">
        {value}
      </h2>

    </div>

  )

}