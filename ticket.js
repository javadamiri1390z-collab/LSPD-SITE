// ===================================
// Vanguard LSPD
// Ticket Tracking + Command Chat
// MongoDB Server Version
// ===================================

const API_URL = "https://lspd-site-11.onrender.com";


// ===================================
// SEARCH TICKET
// ===================================

async function searchTicket() {

    const input = document.getElementById("ticketCode");
    const box = document.getElementById("result");

    if (!input || !box) {
        console.error("ticketCode یا result در HTML پیدا نشد.");
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

        return;
    }

    box.innerHTML = `
        <div class="ticket-card">
            <p>⏳ در حال بررسی درخواست...</p>
        </div>
    `;

    try {

        const response = await fetch(
            API_URL + "/tickets/" + encodeURIComponent(code)
        );

        if (!response.ok) {

            if (response.status === 404) {
                throw new Error("NOT_FOUND");
            }

            throw new Error("SERVER_ERROR");
        }

        const ticket = await response.json();

        renderTicket(ticket);

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
}


// ===================================
// RENDER TICKET
// ===================================

function renderTicket(ticket) {

    const box = document.getElementById("result");

    if (!box) return;

    const messages = Array.isArray(ticket.messages)
        ? ticket.messages
        : [];

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
                ${getStatusText(ticket.status)}
            </p>

            <hr>

            <h3>
                💬 پاسخ فرماندهی
            </h3>

            <div
                style="
                    padding:15px;
                    border-radius:10px;
                    background:rgba(255,255,255,.06);
                    white-space:pre-wrap;
                "
            >
                ${escapeHTML(
                    ticket.reply ||
                    "هنوز پاسخی از فرماندهی ثبت نشده است."
                )}
            </div>

            ${
                ticket.score !== null &&
                ticket.score !== undefined
                ?
                `
                <p>
                    <b>📝 نمره آزمون:</b>
                    ${escapeHTML(ticket.score)} از 20
                </p>

                <p>
                    <b>📌 نتیجه آزمون:</b>
                    ${
                        ticket.passed
                        ? "🟢 قبول شده"
                        : "🔴 مردود شده"
                    }
                </p>
                `
                :
                ""
            }

            <p>

                <b>
                    🕒 تاریخ ثبت:
                </b>

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

            <!-- =========================
                 COMMAND CHAT
            ========================== -->

            <div
                style="
                    padding:15px;
                    border-radius:12px;
                    background:rgba(0,120,255,.08);
                "
            >

                <h3>
                    💬 چت با فرماندهی
                </h3>

                <p style="color:#aaa;">
                    از این بخش می‌توانید مستقیماً با فرماندهی گفتگو کنید.
                </p>

                <div
                    id="chatMessages"
                    style="
                        margin-top:15px;
                        max-height:400px;
                        overflow-y:auto;
                        padding:10px;
                    "
                >
                    ${renderMessages(messages)}
                </div>

                <div
                    style="
                        display:flex;
                        gap:10px;
                        margin-top:15px;
                        align-items:stretch;
                    "
                >

                    <textarea
                        id="chatMessage"
                        placeholder="پیام خود را برای فرماندهی بنویسید..."
                        maxlength="2000"
                        style="
                            flex:1;
                            min-height:80px;
                            resize:vertical;
                        "
                    ></textarea>

                    <button
                        type="button"
                        class="btn primary"
                        onclick="sendApplicantMessage('${escapeHTML(ticket._id)}')"
                    >
                        📤 ارسال
                    </button>

                </div>

            </div>

        </div>
    `;

    scrollChatToBottom();

    setupChatEnter(ticket._id);
}


// ===================================
// RENDER CHAT MESSAGES
// ===================================

function renderMessages(messages) {

    if (!messages || messages.length === 0) {

        return `
            <div
                style="
                    text-align:center;
                    color:#888;
                    padding:25px;
                "
            >
                💬 هنوز پیامی ثبت نشده است.
            </div>
        `;
    }

    return messages.map(message => {

        const isCommand =
            message.sender === "command";

        return `

            <div
                style="
                    display:flex;
                    justify-content:${
                        isCommand
                        ? "flex-start"
                        : "flex-end"
                    };
                    margin-bottom:12px;
                "
            >

                <div
                    style="
                        max-width:80%;
                        padding:12px 15px;
                        border-radius:12px;
                        background:${
                            isCommand
                            ? "rgba(0,120,255,.18)"
                            : "rgba(0,255,136,.12)"
                        };
                    "
                >

                    <div
                        style="
                            font-size:12px;
                            color:#aaa;
                            margin-bottom:5px;
                        "
                    >
                        ${
                            isCommand
                            ? "🚔 فرماندهی"
                            : "👤 شما"
                        }
                    </div>

                    <div
                        style="
                            white-space:pre-wrap;
                            word-break:break-word;
                        "
                    >
                        ${escapeHTML(message.message)}
                    </div>

                    <div
                        style="
                            font-size:11px;
                            color:#777;
                            margin-top:6px;
                        "
                    >
                        ${
                            message.createdAt
                            ?
                            new Date(
                                message.createdAt
                            ).toLocaleString("fa-IR")
                            :
                            ""
                        }
                    </div>

                </div>

            </div>

        `;

    }).join("");
}


// ===================================
// SEND APPLICANT MESSAGE
// ===================================

async function sendApplicantMessage(ticketId) {

    const input =
        document.getElementById("chatMessage");

    if (!input) return;

    const message =
        input.value.trim();

    if (!message) {

        alert("لطفاً پیام خود را بنویسید.");

        return;
    }

    if (message.length > 2000) {

        alert("پیام نمی‌تواند بیشتر از ۲۰۰۰ کاراکتر باشد.");

        return;
    }

    input.disabled = true;

    try {

        const response =
            await fetch(
                API_URL +
                "/tickets/" +
                encodeURIComponent(ticketId) +
                "/messages",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        sender: "applicant",

                        message: message

                    })
                }
            );

        const result =
            await response.json();

        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "خطا در ارسال پیام"
            );
        }

        input.value = "";

        await refreshChat(ticketId);

    } catch (error) {

        console.error(
            "Send Message Error:",
            error
        );

        alert(
            error.message ||
            "خطا در ارسال پیام ❌"
        );

    } finally {

        input.disabled = false;

        input.focus();

    }
}


// ===================================
// REFRESH CHAT
// ===================================

async function refreshChat(ticketId) {

    try {

        const response =
            await fetch(
                API_URL +
                "/tickets/" +
                encodeURIComponent(ticketId) +
                "/messages"
            );

        if (!response.ok) {
            throw new Error("خطا در دریافت پیام‌ها");
        }

        const messages =
            await response.json();

        const chatBox =
            document.getElementById(
                "chatMessages"
            );

        if (!chatBox) return;

        chatBox.innerHTML =
            renderMessages(
                Array.isArray(messages)
                ? messages
                : []
            );

        scrollChatToBottom();

    } catch (error) {

        console.error(
            "Refresh Chat Error:",
            error
        );

    }

}


// ===================================
// SCROLL CHAT
// ===================================

function scrollChatToBottom() {

    const chatBox =
        document.getElementById(
            "chatMessages"
        );

    if (!chatBox) return;

    chatBox.scrollTop =
        chatBox.scrollHeight;
}


// ===================================
// ENTER / CTRL+ENTER
// ===================================

function setupChatEnter(ticketId) {

    const input =
        document.getElementById(
            "chatMessage"
        );

    if (!input) return;

    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                event.ctrlKey
            ) {

                event.preventDefault();

                sendApplicantMessage(
                    ticketId
                );

            }

        }
    );

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
            <span style="color:#00ff88;font-weight:bold;">
                🟢 تایید شده
            </span>
        `;

    }

    if (status === "Rejected") {

        return `
            <span style="color:#ff3333;font-weight:bold;">
                🔴 رد شده
            </span>
        `;

    }

    return `
        <span style="color:#ffaa00;font-weight:bold;">
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
// ENTER FOR SEARCH
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

                        searchTicket();

                    }

                }
            );

        }

    }
);


// ===================================
// AUTO REFRESH CHAT
// ===================================

setInterval(
    async () => {

        const input =
            document.getElementById(
                "ticketCode"
            );

        const chatBox =
            document.getElementById(
                "chatMessages"
            );

        if (
            input &&
            chatBox &&
            input.value.trim()
        ) {

            await refreshChat(
                input.value.trim()
            );

        }

    },
    10000
);
