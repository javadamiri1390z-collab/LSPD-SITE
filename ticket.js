// ===================================
// Vanguard LSPD
// Ticket Tracking + Live Chat
// ===================================

const API_URL = "https://lspd-site-11.onrender.com";

let currentTicket = null;
let chatInterval = null;
let lastMessageCount = 0;


// ===================================
// SEARCH TICKET
// ===================================

async function searchTicket() {

    const input = document.getElementById("ticketCode");
    const box = document.getElementById("result");

    if (!input || !box) return;

    const code = input.value.trim();

    if (!code) {

        box.innerHTML = `
            <div class="ticket-card">
                <p style="color:#ffaa00;">
                    ⚠️ کد پیگیری را وارد کنید.
                </p>
            </div>
        `;

        return;
    }


    box.innerHTML = `
        <div class="ticket-card">
            <p>⏳ در حال بررسی درخواست...</p>
        </div>
    `;


    try {

        const response =
            await fetch(
                API_URL + "/tickets/" + encodeURIComponent(code)
            );


        if (!response.ok) {

            if (response.status === 404) {

                throw new Error("NOT_FOUND");

            }

            throw new Error("SERVER_ERROR");

        }


        const ticket =
            await response.json();


        currentTicket = ticket;

        lastMessageCount = 0;


        renderTicket(ticket);


        startChatPolling();


    } catch (error) {

        console.error("Tracking Error:", error);


        if (error.message === "NOT_FOUND") {

            box.innerHTML = `
                <div class="ticket-card">

                    <h2 style="color:#ff3333;">
                        ❌ درخواست پیدا نشد
                    </h2>

                    <p>
                        کد پیگیری وارد شده صحیح نیست.
                    </p>

                </div>
            `;

        } else {

            box.innerHTML = `
                <div class="ticket-card">

                    <h2 style="color:#ff3333;">
                        ❌ خطا در اتصال به سرور
                    </h2>

                    <p>
                        لطفاً چند لحظه بعد دوباره تلاش کنید.
                    </p>

                </div>
            `;

        }

    }

}


// ===================================
// RENDER TICKET
// ===================================

function renderTicket(ticket) {

    const box =
        document.getElementById("result");


    const status =
        getStatusText(ticket.status);


    box.innerHTML = `

        <div class="ticket-card">

            <h2>
                📄 اطلاعات درخواست
            </h2>


            <p>
                <b>کد پیگیری:</b>
                ${escapeHTML(ticket._id)}
            </p>


            <p>
                <b>نوع درخواست:</b>
                ${getRequestType(ticket.requestType)}
            </p>


            <p>
                <b>IC Name:</b>
                ${escapeHTML(
                    ticket.icName ||
                    ticket.name ||
                    "-"
                )}
            </p>


            <p>
                <b>OOC Name:</b>
                ${escapeHTML(
                    ticket.ocName ||
                    ticket.oocName ||
                    "-"
                )}
            </p>


            <p>
                <b>Discord:</b>
                ${escapeHTML(
                    ticket.discordId ||
                    ticket.discord ||
                    "-"
                )}
            </p>


            <p>
                <b>وضعیت:</b>
                ${status}
            </p>


            <p>

                <b>🕒 تاریخ ثبت:</b>

                ${
                    ticket.createdAt
                    ?
                    new Date(
                        ticket.createdAt
                    ).toLocaleString("fa-IR")
                    :
                    "-"
                }

            </p>


            <hr>


            <!-- COMMAND REPLY -->

            <h3>
                📢 پاسخ فرماندهی
            </h3>


            <div
                id="commandReply"
                style="
                    padding:15px;
                    border-radius:10px;
                    background:rgba(255,255,255,.06);
                    white-space:pre-wrap;
                    margin-bottom:20px;
                "
            >

                ${escapeHTML(
                    ticket.reply ||
                    "هنوز پاسخی از فرماندهی ثبت نشده است."
                )}

            </div>


            <!-- CHAT -->

            <div
                class="live-chat"
                style="
                    margin-top:20px;
                    padding:18px;
                    border-radius:14px;
                    background:rgba(0,120,255,.06);
                    border:1px solid rgba(255,255,255,.1);
                "
            >

                <h2>
                    💬 گفت‌وگو با فرماندهی
                </h2>


                <p
                    style="
                        color:#aaa;
                        font-size:13px;
                    "
                >
                    پیام‌ها به صورت خودکار بروزرسانی می‌شوند.
                </p>


                <div
                    id="chatMessages"
                    style="
                        max-height:400px;
                        overflow-y:auto;
                        margin:15px 0;
                        padding:10px;
                    "
                >

                    <p style="color:#aaa;">
                        ⏳ در حال دریافت پیام‌ها...
                    </p>

                </div>


                <div
                    style="
                        display:flex;
                        gap:10px;
                        flex-wrap:wrap;
                    "
                >

                    <textarea
                        id="chatInput"
                        placeholder="پیام خود را برای فرماندهی بنویسید..."
                        style="
                            flex:1;
                            min-height:80px;
                            resize:vertical;
                        "
                    ></textarea>


                    <button
                        class="btn primary"
                        onclick="sendApplicantMessage()"
                    >
                        📤 ارسال
                    </button>

                </div>

            </div>

        </div>

    `;


    loadMessages();


}


// ===================================
// LOAD MESSAGES
// ===================================

async function loadMessages() {

    if (!currentTicket) return;


    try {

        const response =
            await fetch(
                API_URL +
                "/tickets/" +
                encodeURIComponent(
                    currentTicket._id
                ) +
                "/messages"
            );


        if (!response.ok) {
            return;
        }


        const messages =
            await response.json();


        if (!Array.isArray(messages)) {
            return;
        }


        /*
        اگر پیام جدید آمده باشد
        */

        if (
            messages.length !==
            lastMessageCount
        ) {

            renderMessages(messages);

            lastMessageCount =
                messages.length;

        }


    } catch (error) {

        console.error(
            "Load Messages Error:",
            error
        );

    }

}


// ===================================
// RENDER MESSAGES
// ===================================

function renderMessages(messages) {

    const box =
        document.getElementById(
            "chatMessages"
        );


    if (!box) return;


    if (!messages.length) {

        box.innerHTML = `
            <p style="color:#888;text-align:center;">
                هنوز پیامی ارسال نشده است.
            </p>
        `;

        return;

    }


    box.innerHTML = "";


    messages.forEach(message => {

        const isCommand =
            message.sender === "command";


        const messageDiv =
            document.createElement("div");


        messageDiv.style.cssText = `

            margin:10px 0;

            padding:12px;

            border-radius:12px;

            ${
                isCommand
                ?
                `
                background:rgba(0,120,255,.12);
                border-right:3px solid #008cff;
                `
                :
                `
                background:rgba(255,255,255,.06);
                border-left:3px solid #aaa;
                `
            }

        `;


        const sender =
            isCommand
            ?
            "🚔 فرماندهی"
            :
            "👤 شما";


        const date =
            message.createdAt
            ?
            new Date(
                message.createdAt
            ).toLocaleString("fa-IR")
            :
            "";


        messageDiv.innerHTML = `

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    gap:10px;
                    margin-bottom:6px;
                "
            >

                <strong>
                    ${sender}
                </strong>

                <small style="color:#888;">
                    ${escapeHTML(date)}
                </small>

            </div>


            <div
                style="
                    white-space:pre-wrap;
                    word-break:break-word;
                "
            >
                ${escapeHTML(
                    message.message
                )}
            </div>

        `;


        box.appendChild(messageDiv);

    });


    /*
    اسکرول به آخرین پیام
    */

    box.scrollTop =
        box.scrollHeight;

}


// ===================================
// SEND APPLICANT MESSAGE
// ===================================

async function sendApplicantMessage() {

    if (!currentTicket) {

        alert(
            "ابتدا یک کد پیگیری معتبر وارد کنید."
        );

        return;

    }


    const input =
        document.getElementById(
            "chatInput"
        );


    if (!input) return;


    const message =
        input.value.trim();


    if (!message) {

        alert(
            "پیام نمی‌تواند خالی باشد."
        );

        return;

    }


    if (message.length > 2000) {

        alert(
            "پیام نمی‌تواند بیشتر از ۲۰۰۰ کاراکتر باشد."
        );

        return;

    }


    const button =
        document.querySelector(
            ".live-chat .btn.primary"
        );


    if (button) {

        button.disabled = true;

        button.innerText =
            "⏳ در حال ارسال...";

    }


    try {

        const response =
            await fetch(

                API_URL +
                "/tickets/" +
                encodeURIComponent(
                    currentTicket._id
                ) +
                "/messages",

                {

                    method:"POST",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:JSON.stringify({

                        sender:"applicant",

                        message:message

                    })

                }

            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "ارسال پیام ناموفق بود"
            );

        }


        input.value = "";


        /*
        بلافاصله پیام را دریافت کن
        */

        await loadMessages();


    } catch (error) {

        console.error(
            "Send Message Error:",
            error
        );


        alert(
            error.message ||
            "خطا در ارسال پیام"
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.innerText =
                "📤 ارسال";

        }

    }

}


// ===================================
// LIVE CHAT POLLING
// ===================================

function startChatPolling() {

    /*
    اگر قبلاً فعال بوده متوقفش کن
    */

    if (chatInterval) {

        clearInterval(
            chatInterval
        );

    }


    /*
    دریافت اولیه
    */

    loadMessages();


    /*
    هر ۲ ثانیه بررسی پیام جدید
    */

    chatInterval =
        setInterval(

            () => {

                loadMessages();

            },

            2000

        );

}


// ===================================
// STOP POLLING
// ===================================

function stopChatPolling() {

    if (chatInterval) {

        clearInterval(
            chatInterval
        );

        chatInterval = null;

    }

}


// ===================================
// REQUEST TYPE
// ===================================

function getRequestType(type) {

    switch (type) {

        case "membership":
            return "🚔 درخواست عضویت";

        case "division":
            return "🎖️ درخواست دیویژن";

        case "resignation":
            return "📤 درخواست استعفا";

        case "rankup":
            return "⬆️ درخواست رنکاپ";

        default:
            return "📄 درخواست";

    }

}


// ===================================
// STATUS
// ===================================

function getStatusText(status) {

    if (status === "Accepted") {

        return `
            <span style="color:#00ff88;">
                🟢 تایید شده
            </span>
        `;

    }


    if (status === "Rejected") {

        return `
            <span style="color:#ff4444;">
                🔴 رد شده
            </span>
        `;

    }


    return `
        <span style="color:#ffaa00;">
            🟡 در انتظار بررسی
        </span>
    `;

}


// ===================================
// ESCAPE HTML
// ===================================

function escapeHTML(value) {

    return String(value ?? "")

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// ===================================
// ENTER
// ===================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const input =
            document.getElementById(
                "ticketCode"
            );


        if (input) {

            input.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter"
                    ) {

                        event.preventDefault();

                        searchTicket();

                    }

                }
            );

        }

    }
);


// ===================================
// CLEANUP
// ===================================

window.addEventListener(
    "beforeunload",
    () => {

        stopChatPolling();

    }
);
