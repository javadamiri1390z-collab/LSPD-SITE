// آدرس سرور Render
const SERVER_URL = "https://lspd-site-7.onrender.com";



// ===============================
// ارسال تیکت
// ===============================

async function sendTicket(){


    const ticket = {


        name: document.getElementById("name").value,

        discord: document.getElementById("discord").value,

        age: document.getElementById("age").value,

        experience: document.getElementById("experience").value,

        reason: document.getElementById("reason").value


    };



    // چک خالی بودن فرم

    if(
        !ticket.name ||
        !ticket.discord ||
        !ticket.age ||
        !ticket.experience ||
        !ticket.reason
    ){

        alert("لطفاً تمام فیلدها را پر کنید ❌");

        return;

    }




    try{


        let response = await fetch(

            SERVER_URL + "/tickets",

            {

                method:"POST",

                headers:{

                    "Content-Type":"application/json"

                },


                body:JSON.stringify(ticket)

            }

        );



        if(!response.ok){

            throw new Error(
                "Server Error " + response.status
            );

        }



        let data = await response.json();



        if(data.success){


            alert(
                "تیکت با موفقیت ارسال شد ✅"
            );


            // پاک کردن فرم

            document.getElementById("name").value="";
            document.getElementById("discord").value="";
            document.getElementById("age").value="";
            document.getElementById("experience").value="";
            document.getElementById("reason").value="";



        }else{


            alert(
                "ارسال تیکت ناموفق بود ❌"
            );


        }



    }catch(error){


        console.log(error);


        alert(

            "خطا در اتصال به سرور ❌\n" +
            error.message

        );


    }



}






// ===============================
// دریافت تیکت ها برای پنل فرماندهی
// ===============================


async function loadTickets(){


    try{


        let response = await fetch(

            SERVER_URL + "/tickets"

        );



        if(!response.ok){

            throw new Error(
                "Server Error " + response.status
            );

        }



        let tickets = await response.json();



        return tickets;



    }catch(error){


        console.log(error);


        return [];


    }


}






// ===============================
// تست اتصال سرور
// ===============================


async function checkServer(){


    try{


        let response = await fetch(

            SERVER_URL + "/status"

        );


        let data = await response.json();


        console.log(
            "Server:",
            data.message
        );



    }catch(error){


        console.log(
            "Server Offline"
        );


    }


}


// اجرای تست هنگام باز شدن سایت

checkServer();
