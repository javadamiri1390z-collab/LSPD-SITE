const express = require("express");
const cors = require("cors");

const app = express();


// فعال کردن CORS برای گوشی و سایت
app.use(cors({
    origin: "*"
}));


// خواندن JSON
app.use(express.json());


// ذخیره موقت تیکت‌ها
let tickets = [];


// تست آنلاین بودن سرور
app.get("/", (req, res) => {

    res.json({
        status: "online",
        message: "LSPD Server Running"
    });

});


// ارسال تیکت از سایت / گوشی
app.post("/tickets", (req, res) => {

    try {

        const ticket = {

            id: Date.now(),

            name: req.body.name || "",
            discord: req.body.discord || "",
            age: req.body.age || "",
            experience: req.body.experience || "",
            reason: req.body.reason || "",

            status: "جدید",

            createdAt: new Date()

        };


        tickets.push(ticket);


        console.log("New Ticket:", ticket);


        res.json({

            success: true,
            message: "Ticket created"

        });


    } catch(error) {


        console.log(error);


        res.status(500).json({

            success:false,
            message:"Server error"

        });


    }

});



// نمایش تیکت‌ها برای پنل فرماندهی
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
