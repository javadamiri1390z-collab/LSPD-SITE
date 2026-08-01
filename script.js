// ===================================
// Vanguard LSPD System
// Main Script
// Server Ticket Version
// ===================================


const API_URL = "https://lspd-site-11.onrender.com";




// ===============================
// Page Load Effect
// ===============================

window.addEventListener("load",()=>{

    document.body.classList.add("loaded");

});





// ===============================
// Button Effects
// ===============================

document.addEventListener("DOMContentLoaded",()=>{


const buttons =
document.querySelectorAll(".btn,.login-btn");


buttons.forEach(btn=>{


btn.addEventListener("mouseenter",()=>{

btn.style.transform="translateY(-3px)";

});


btn.addEventListener("mouseleave",()=>{

btn.style.transform="translateY(0)";

});


});


});







// ===============================
// CREATE TICKET
// ===============================


async function createTicket(data){


try{


let response = await fetch(

API_URL + "/tickets",

{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify(data)

}

);



let result = await response.json();



if(result.success){

return result.id;

}
else{

alert("ارسال تیکت ناموفق بود ❌");

return null;

}



}

catch(error){


console.error(
"Ticket Error:",
error
);


alert(
"خطا در اتصال به سرور ❌"
);


return null;


}


}









// ===============================
// GET ALL TICKETS
// ===============================


async function getTickets(){


try{


let response = await fetch(

API_URL + "/tickets"

);



let data = await response.json();



return data;



}

catch(error){


console.error(
"Get Tickets Error:",
error
);


return [];

}


}









// ===============================
// DELETE TICKET
// ===============================


async function deleteTicket(id){


try{


let response = await fetch(

API_URL + "/tickets/" + id,

{

method:"DELETE"

}

);



return true;



}

catch(error){


console.error(error);


return false;


}


}









// ===============================
// UPDATE TICKET
// ===============================


async function updateTicket(id,status,reply){


try{


await fetch(

API_URL + "/tickets/" + id,

{

method:"PUT",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify({

status:status,

reply:reply

})

}

);



return true;


}

catch(error){


console.error(error);


return false;


}


}









// ===============================
// ADMIN LOGIN CHECK
// ===============================


function checkAdmin(){


let admin =
localStorage.getItem(
"lspdAdmin"
);



if(admin !== "true"){


window.location.href =
"login.html";


}


}









// ===============================
// ADMIN LOGOUT
// ===============================


function logoutAdmin(){


localStorage.removeItem(
"lspdAdmin"
);



window.location.href =
"login.html";


}







console.log(
"Vanguard LSPD Server System Online"
);
