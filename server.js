const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());


// نمایش فایل‌های سایت
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});


const PORT = process.env.PORT || 3000;

const FILE = "./tickets.json";


// ===============================
// خواندن تیکت ها
// ===============================

function getTickets(){

    if(!fs.existsSync(FILE)){
        fs.writeFileSync(FILE, "[]");
    }

    let data = fs.readFileSync(FILE, "utf8");

    if(!data){
        return [];
    }

    try{
        return JSON.parse(data);
    }
    catch(error){
        return [];
    }
}



// ===============================
// ذخیره تیکت ها
// ===============================

function saveTickets(data){

    fs.writeFileSync(
        FILE,
        JSON.stringify(data,null,2)
    );

}



// ===============================
// دریافت همه تیکت ها
// ===============================

app.get("/tickets",(req,res)=>{

    res.json(
        getTickets()
    );

});




// ===============================
// ساخت تیکت جدید
// ===============================

app.post("/tickets",(req,res)=>{


    let tickets = getTickets();


    let ticket = {

        id: Date.now(),

        name:req.body.name,

        discord:req.body.discord,

        age:req.body.age,

        experience:req.body.experience,

        reason:req.body.reason,

        status:"Pending",

        reply:"در انتظار بررسی فرماندهی",

        date:new Date().toLocaleString("fa-IR")

    };


    tickets.push(ticket);


    saveTickets(tickets);


    res.json({

        success:true,

        id:ticket.id

    });


});





// ===============================
// تغییر وضعیت و پاسخ فرمانده
// ===============================

app.put("/tickets/:id",(req,res)=>{


    let tickets = getTickets();


    let ticket = tickets.find(
        t => t.id == req.params.id
    );


    if(ticket){


        ticket.status =
        req.body.status || ticket.status;


        ticket.reply =
        req.body.reply || ticket.reply;


        saveTickets(tickets);


        res.json({
            success:true
        });


    }else{


        res.json({
            success:false
        });


    }


});







// ===============================
// حذف تیکت
// ===============================

app.delete("/tickets/:id",(req,res)=>{


    let tickets = getTickets();


    tickets = tickets.filter(
        t => t.id != req.params.id
    );


    saveTickets(tickets);


    res.json({
        success:true
    });


});






app.listen(PORT,()=>{

    console.log(
        `LSPD Server running on port ${PORT}`
    );

});
