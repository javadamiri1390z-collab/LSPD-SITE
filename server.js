const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();


// اجازه اتصال سایت و گوشی
app.use(cors());


// خواندن JSON
app.use(express.json());


// فعال کردن فایل های سایت
app.use(express.static(path.join(__dirname, "public")));


// ذخیره تیکت ها
let tickets = [];



// صفحه اصلی سایت
app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );

});



// تست سرور
app.get("/status", (req, res) => {

    res.json({

        status: "online",

        message: "LSPD Server Running"

    });

});




// ارسال تیکت
app.post("/tickets", (req, res) => {


    const newTicket = {


        id: Date.now(),

        name: req.body.name || "",

        discord: req.body.discord || "",

        age: req.body.age || "",

        experience: req.body.experience || "",

        reason: req.body.reason || "",


        status: "جدید",

        time: new Date()


    };



    tickets.push(newTicket);



    console.log(
        "New Ticket:",
        newTicket
    );



    res.json({

        success: true,

        message: "Ticket Saved"

    });


});




// نمایش تیکت ها برای پنل فرماندهی
app.get("/tickets", (req,res)=>{


    res.json(tickets);


});




// حذف تیکت
app.delete("/tickets/:id",(req,res)=>{


    tickets = tickets.filter(

        t => t.id != req.params.id

    );


    res.json({

        success:true

    });


});





// پورت Render
const PORT = process.env.PORT || 3000;



app.listen(PORT,()=>{


    console.log(

        "LSPD Server running on port " + PORT

    );


});
