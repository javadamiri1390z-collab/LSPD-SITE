// ===================================
// Vanguard LSPD
// Ticket Tracking
// MongoDB Server Version
// ===================================

const API_URL =
    "https://lspd-site-11.onrender.com";


// ===================================
// SEARCH TICKET
// ===================================

async function searchTicket() {

    const input =
        document.getElementById("ticketCode");

    const box =
        document.getElementById("result");


    if (!input || !box) {
        console.error(
            "ticketCode یا result در HTML پیدا نشد."
        );
        return;
    }


    const code =
        input.value.trim();


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
            <p>
                ⏳ در حال بررسی درخواست...
            </p>
        </div>
    `;


    try {

        const response =
            await fetch(
                API_URL + "/tickets"
            );


        if (!response.ok) {
            throw new Error(
                "Server Error"
            );
        }


        const tickets =
            await response.json();


        const ticket =
            tickets.find(
                t =>
                    String(t._id) ===
                    String(code)
            );


        if (!ticket) {

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


                <div
                    style="
                        padding:15px;
                        border-radius:10px;
                        background:rgba(0,120,255,.08);
                    "
                >

                    <h3>
                        💬 چت با فرماندهی
                    </h3>

                    <p style="color:#aaa;">
                        بخش چت دوطرفه بعد از فعال شدن API چت در سرور قابل استفاده خواهد بود.
                    </p>

                </div>

            </div>

        `;


    } catch (error) {

        console.error(
            "Tracking Error:",
            error
        );


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
        return "🟢 تایید شده";
    }

    if (status === "Rejected") {
        return "🔴 رد شده";
    }

    return "🟡 در انتظار بررسی";

}


// ===================================
// ESCAPE HTML
// ===================================

function escapeHTML(value) {

    return String(value ?? "")

        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

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

                        searchTicket();

                    }

                }
            );

        }

    }
);
