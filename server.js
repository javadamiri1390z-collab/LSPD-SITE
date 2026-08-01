// ===================================
// Vanguard LSPD System
// MongoDB Ticket Server
// ===================================


const express = require("express");
const cors = require("cors");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");


const app = express();


app.use(cors());

app.use(express.json());


// فایل های سایت
app.use(express.static(__dirname));



app.get("/", (req,res)=>{

    res.sendFile(
        path.join(__dirname,"index.html")
    );

});




// MongoDB Connection

const MONGO_URI = process.env.MONGODB_URI;


const client = new MongoClient(MONGO_URI);



let tickets;



async function startServer(){


    await client.connect();


    console.log("MongoDB Connected ✅");



    const database = client.db("LSPD");


    tickets = database.collection("tickets");





    // گرفتن همه تیکت ها

    app.get("/tickets", async(req,res)=>{


        const data = await tickets
        .find({})
        .sort({createdAt:-1})
        .toArray();


        res.json(data);


    });






    // ساخت تیکت جدید

    app.post("/tickets", async(req,res)=>{


        const ticket = {


            name:req.body.name || "",

            discord:req.body.discord || "",

            age:req.body.age || "",

            experience:req.body.experience || "",

            reason:req.body.reason || "",


            status:"Pending",

            reply:"در انتظار پاسخ فرماندهی",


            createdAt:new Date()



        };



        const result =
        await tickets.insertOne(ticket);



        res.json({

            success:true,

            id:result.insertedId


        });



    });








    // تغییر وضعیت تیکت

    app.put("/tickets/:id", async(req,res)=>{


        await tickets.updateOne(


            {
                _id:new ObjectId(req.params.id)
            },


            {

                $set:{

                    status:req.body.status,

                    reply:req.body.reply

                }

            }


        );



        res.json({

            success:true

        });


    });








    // حذف تیکت

    app.delete("/tickets/:id", async(req,res)=>{


        await tickets.deleteOne({


            _id:new ObjectId(req.params.id)


        });



        res.json({

            success:true

        });



    });







    const PORT = process.env.PORT || 3000;



    app.listen(PORT,()=>{


        console.log(
            "LSPD Server running on port " + PORT
        );


    });



}



startServer();
