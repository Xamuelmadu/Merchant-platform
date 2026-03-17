const fs = require("fs")
const csv = require("csv-parser")

const Product = require("../models/Product")

async function importCSV(filePath, storeId){

  return new Promise((resolve,reject)=>{

    const products = []

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data",(row)=>{

        products.push({

          store_id:storeId,

          name:row.name,

          description:row.description,

          price:Number(row.price),

          stock:Number(row.stock),

          images:[row.image],

          source:"csv"

        })

      })
      .on("end",async ()=>{

        await Product.insertMany(products)

        resolve(products.length)

      })
      .on("error",reject)

  })

}

module.exports = {importCSV}