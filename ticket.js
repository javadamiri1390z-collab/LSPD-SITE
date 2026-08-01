// ===================================
// Vanguard LSPD Ticket Tracking
// MongoDB Version
// ===================================


const API_URL = "https://lspd-site-11.onrender.com";




// جستجوی تیکت

async function searchTicket(){


let code =
document.getElementById("ticketCode").value.trim();



if(!code){

alert("کد پیگیری را وارد کنید");

return;

}




try{


let response =
await fetch(API_URL + "/tickets");



let tickets =
await response.json();



let ticket =
tickets.find(t => 
t._id === code
);





let box =
document.getElementById("result");




if(ticket){



box.innerHTML = `


<div class="ticket">


<h2>
${ticket.name}
</h2>



<p>
وضعیت:
<b>${ticket.status}</b>
</p>



<p>
پاسخ فرمانده:
</p>



<p>
${ticket.reply}
</p>



<p>
تاریخ ثبت:
${new Date(ticket.createdAt).toLocaleString("fa-IR")}
</p>



</div>


`;



}else{


box.innerHTML = `

<p>
تیکتی با این کد پیدا نشد ❌
</p>

`;



}



}

catch(error){


console.error(error);


alert(
"خطا در اتصال به سرور"
);


}



}
