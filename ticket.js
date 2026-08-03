// ===================================
// Vanguard LSPD
// Ticket Tracking
// MongoDB + Live Chat
// ===================================

const API_URL = "https://lspd-site-11.onrender.com";

const REFRESH_INTERVAL = 2000;

let currentTicketId = null;
let refreshTimer = null;
let isRefreshing = false;


// ===================================
// SEARCH TICKET
// ===================================

async function searchTicket() {

    const input = document.getElementById("ticketCode");
    const box = document.getElementById("result");

    if (!input || !box) {
        console.error("ticketCode یا result پیدا نشد.");
        return;
    }

    const code = input.value.trim();

    if (!code) {

        box.innerHTML = `
            <div class="ticket-card">
                <p style="color:#ffaa00;">
                    ⚠️ کد پیگیری را وارد کنید.
                </p>
            </div>
        `;

        stopLiveRefresh();

        return;
    }

    currentTicketId = code;

    box.innerHTML = `
        <div class="ticket-card">
            <p>⏳ در حال دریافت اطلاعات درخواست...</p>
        </div>
    `;

    await refreshTicket();

    startLiveRefresh();
}


// ===================================
// GET SINGLE TICKET
// ===================================

async function refreshTicket() {

    if (!currentTicketId || isRefreshing) {
        return;
    }

    isRefreshing = true;

    try {

        const response = await fetch(
            API_URL + "/tickets/" + encodeURIComponent(currentTicketId),
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!response.ok) {

            if (response.status === 404) {

                showNotFound();

                stopLiveRefresh();

                return;
            }

            throw new Error(
                "Server Error: " + response.status
            );
        }

        const ticket = await response.json();

        renderTicket(ticket);

    } catch (error) {

        console.error(
            "Tracking Error:",
            error
        );

        /*
         * اگر قبلاً تیکت نمایش داده شده باشد،
         * هنگام خطای موقت صفحه را خراب نمی‌کنیم.
         */

        if (!document.querySelector(".ticket-card")) {

            showConnectionError();

        }

    } finally {

        isRefreshing = false;

    }

}


// ===================================
// RENDER TICKET
// ===================================

function renderTicket(ticket) {

    const box =
        document.getElementById("result");

    if (!box) {
        return;
    }

    const status =
        getStatusText(ticket.status);

    const type =
        getRequestType(ticket.requestType);

    const messages =
        Array.isArray(ticket.messages)
            ? ticket.messages
            : [];


    let chatHTML = "";


    // ===================================
    // CHAT
    // ===================================

    if (messages.length === 0) {

        chatHTML = `
            <div
                style="
                    padding:12px;
                    color:#999;
                    text-align:center;
                "
            >
                هنوز پیامی ارسال نشده است.
            </div>
        `;

    } else {

        chatHTML = messages.map(message => {

            const sender =
                message.sender === "command"
                    ? "فرماندهی"
                    : "متقاضی";

            const senderClass =
                message.sender === "command"
                    ? "command-message"
                    : "applicant-message";

            const date =
                message.createdAt
                    ? new Date(
                        message.createdAt
                    ).toLocaleString("fa-IR")
                    : "";


            return `

                <div
                    class="${senderClass}"
                    style="
                        margin:10px 0;
                        padding:12px;
                        border-radius:12px;
                        background:rgba(255,255,255,.06);
                    "
                >

                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            gap:10px;
                            margin-bottom:6px;
                        "
                    >

                        <strong>
                            ${
                                message.sender === "command"
                                ? "👮 فرماندهی"
                                : "👤 شما"
                            }
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
                        ${escapeHTML(message.message)}
                    </div>

                </div>

            `;

        }).join("");

    }


    // ===================================
    // MAIN
    // ===================================

    box.innerHTML = `

        <div class="ticket-card">

            <h2>
                📄 اطلاعات درخواست
            </h2>


            <p>
                <b>کد پیگیری:</b>
                ${escapeHTML(ticket._id || "-")}
            </p>


            <p>
                <b>نوع درخواست:</b>
                ${type}
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


            <hr>


            <!-- ===================================
                 COMMAND REPLY
            =================================== -->

            <h3>
                👮 پاسخ فرماندهی
            </h3>


            <div
                style="
                    padding:15px;
                    border-radius:10px;
                    background:rgba(255,255,255,.06);
                    white-space:pre-wrap;
                    word-break:break-word;
                "
            >

                ${escapeHTML(
                    ticket.reply ||
                    "هنوز پاسخی از فرماندهی ثبت نشده است."
                )}

            </div>


            <p>

                <b>
                    🕒 تاریخ ثبت:
                </b>

                ${
                    ticket.createdAt
                    ? new Date(
                        ticket.createdAt
                      ).toLocaleString(
                        "fa-IR"
                      )
                    : "-"
                }

            </p>


            <hr>


            <!-- ===================================
                 LIVE CHAT
            =================================== -->

            <div
                class="command-chat-box"
                style="
                    margin-top:20px;
                    padding:15px;
                    border-radius:14px;
                    background:rgba(0,120,255,.06);
                    border:1px solid rgba(255,255,255,.08);
                "
            >

                <h3>
                    💬 گفت‌وگو با فرماندهی
                </h3>


                <div
                    id="ticketMessages"
                    style="
                        max-height:450px;
                        overflow-y:auto;
                        margin:15px 0;
                    "
                >

                    ${chatHTML}

                </div>


                <div
                    style="
                        display:flex;
                        gap:10px;
                        flex-wrap:wrap;
                    "
                >

                    <textarea
                        id="ticketMessage"
                        placeholder="پیام خود را برای فرماندهی بنویسید..."
                        maxlength="2000"
                        style="
                            flex:1;
                            min-width:220px;
                            min-height:90px;
                            resize:vertical;
                        "
                    ></textarea>


                    <button
                        type="button"
                        class="btn primary"
                        onclick="sendTicketMessage()"
                    >
                        📤 ارسال پیام
                    </button>

                </div>


                <p
                    style="
                        color:#888;
                        font-size:12px;
                        margin-top:10px;
                    "
                >
                    🔄 پیام‌های جدید به‌صورت خودکار هر ۲ ثانیه بررسی می‌شوند.
                </p>

            </div>

        </div>

    `;


    /*
     * بعد از Render دوباره به پایین چت اسکرول نمی‌کنیم،
     * چون این کار هنگام Polling آزاردهنده است.
     */

}


// ===================================
// SEND MESSAGE
// ===================================

async function sendTicketMessage() {

    if (!currentTicketId) {

        alert(
            "ابتدا یک کد پیگیری را جستجو کنید."
        );

        return;
    }


    const input =
        document.getElementById(
            "ticketMessage"
        );


    if (!input) {
        return;
    }


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
            ".command-chat-box button"
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
                    currentTicketId
                ) +
                "/messages",

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        message: message,

                        sender: "applicant"

                    })

                }

            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "ارسال پیام ناموفق بود"
            );

        }


        input.value = "";


        /*
         * بلافاصله بعد از ارسال،
         * تیکت را دوباره می‌گیریم.
         */

        await refreshTicket();


    } catch (error) {

        console.error(
            "Send Message Error:",
            error
        );


        alert(
            "❌ ارسال پیام انجام نشد."
        );


    } finally {

        if (button) {

            button.disabled = false;

            button.innerText =
                "📤 ارسال پیام";

        }

    }

}


// ===================================
// LIVE REFRESH
// ===================================

function startLiveRefresh() {

    stopLiveRefresh();


    /*
     * هر ۲ ثانیه تیکت را بررسی می‌کند.
     */

    refreshTimer =
        setInterval(
            refreshTicket,
            REFRESH_INTERVAL
        );

}


function stopLiveRefresh() {

    if (refreshTimer) {

        clearInterval(
            refreshTimer
        );

        refreshTimer = null;

    }

}


// ===================================
// NOT FOUND
// ===================================

function showNotFound() {

    const box =
        document.getElementById("result");

    if (!box) {
        return;
    }


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

}


// ===================================
// CONNECTION ERROR
// ===================================

function showConnectionError() {

    const box =
        document.getElementById("result");

    if (!box) {
        return;
    }


    box.innerHTML = `

        <div class="ticket-card">

            <p style="color:#ff3333;">
                ❌ خطا در اتصال به سرور.
            </p>

            <p style="color:#aaa;">
                لطفاً چند لحظه بعد دوباره امتحان کنید.
            </p>

        </div>

    `;

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
// ENTER TO SEARCH
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

        stopLiveRefresh();

    }
);
