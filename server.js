const SERVER_URL = "https://lspd-site-2.onrender.com";


// ارسال تیکت
async function sendTicket(){

    const ticket = {

        name: document.getElementById("name").value,

        discord: document.getElementById("discord").value,

        age: document.getElementById("age").value,

        experience: document.getElementById("experience").value,

        reason: document.getElementById("reason").value

    };


    try{

        let response = await fetch(
            SERVER_URL + "/tickets",
            {

                method:"POST",

                headers:{
                    "Content-Type":"application/json"
                },

                body: JSON.stringify(ticket)

            }
        );


        let data = await response.json();


        if(data.success){

            alert("تیکت با موفقیت ارسال شد ✅");

        }else{

            alert("ارسال تیکت ناموفق بود ❌");

        }


    }catch(error){

        console.log(error);

        alert("خطا در اتصال به سرور ❌");

    }

}



// گرفتن تیکت ها برای پنل ادمین
async function loadTickets(){

    try{

        let response = await fetch(
            SERVER_URL + "/tickets"
        );


        let tickets = await response.json();


        return tickets;


    }catch(error){

        console.log(error);

        return [];

    }

}
