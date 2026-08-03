// ===================================
// Vanguard LSPD System
// Main Script
// MongoDB Ticket Server
// ===================================

const API_URL = "https://lspd-site-11.onrender.com";


// ===================================
// PAGE LOAD
// ===================================

window.addEventListener("load", () => {

    document.body.classList.add("loaded");

});


// ===================================
// BUTTON EFFECTS
// ===================================

document.addEventListener("DOMContentLoaded", () => {

    const buttons =
        document.querySelectorAll(".btn, .login-btn");

    buttons.forEach(btn => {

        btn.addEventListener("mouseenter", () => {

            btn.style.transform =
                "translateY(-3px)";

        });

        btn.addEventListener("mouseleave", () => {

            btn.style.transform =
                "translateY(0)";

        });

    });

});


// ===================================
// CREATE TICKET
// ===================================

async function createTicket(data) {

    try {

        const response =
            await fetch(
                API_URL + "/tickets",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(data)
                }
            );


        const result =
            await response.json();


        if (!response.ok || !result.success) {

            console.error(
                "Create Ticket Error:",
                result
            );

            alert(
                result.message ||
                "ارسال درخواست ناموفق بود ❌"
            );

            return null;

        }


        return result.id;

    }

    catch (error) {

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


// ===================================
// GET ALL TICKETS
// ===================================

async function getTickets() {

    try {

        const response =
            await fetch(
                API_URL + "/tickets",
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Server returned " +
                response.status
            );

        }


        const data =
            await response.json();


        if (!Array.isArray(data)) {

            console.error(
                "Invalid tickets response:",
                data
            );

            return [];

        }


        return data;

    }

    catch (error) {

        console.error(
            "Get Tickets Error:",
            error
        );

        return [];

    }

}


// ===================================
// GET SINGLE TICKET
// ===================================

async function getTicket(id) {

    if (!id) {
        return null;
    }


    try {

        const response =
            await fetch(
                API_URL +
                "/tickets/" +
                encodeURIComponent(id),
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            return null;

        }


        return await response.json();

    }

    catch (error) {

        console.error(
            "Get Ticket Error:",
            error
        );

        return null;

    }

}


// ===================================
// DELETE TICKET
// ===================================

async function deleteTicket(id) {

    if (!id) {

        return false;

    }


    try {

        const response =
            await fetch(
                API_URL +
                "/tickets/" +
                encodeURIComponent(id),
                {
                    method: "DELETE"
                }
            );


        const result =
            await response.json();


        return (
            response.ok &&
            result.success === true
        );

    }

    catch (error) {

        console.error(
            "Delete Ticket Error:",
            error
        );

        return false;

    }

}


// ===================================
// UPDATE TICKET
// ===================================

async function updateTicket(
    id,
    status,
    reply
) {

    if (!id) {

        return false;

    }


    try {

        const response =
            await fetch(
                API_URL +
                "/tickets/" +
                encodeURIComponent(id),
                {

                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            status:
                                status || "Pending",

                            reply:
                                reply || ""

                        })

                }
            );


        const result =
            await response.json();


        return (
            response.ok &&
            result.success === true
        );

    }

    catch (error) {

        console.error(
            "Update Ticket Error:",
            error
        );

        return false;

    }

}


// ===================================
// GET CHAT MESSAGES
// ===================================

async function getTicketMessages(id) {

    if (!id) {

        return [];

    }


    try {

        const response =
            await fetch(
                API_URL +
                "/tickets/" +
                encodeURIComponent(id) +
                "/messages",
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            return [];

        }


        const messages =
            await response.json();


        return Array.isArray(messages)
            ? messages
            : [];

    }

    catch (error) {

        console.error(
            "Get Messages Error:",
            error
        );

        return [];

    }

}


// ===================================
// SEND CHAT MESSAGE
// ===================================

async function sendTicketMessage(
    id,
    message,
    sender = "applicant"
) {

    if (!id || !message) {

        return null;

    }


    try {

        const response =
            await fetch(
                API_URL +
                "/tickets/" +
                encodeURIComponent(id) +
                "/messages",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            message:
                                String(message).trim(),

                            sender:
                                sender === "command"
                                    ? "command"
                                    : "applicant"

                        })

                }
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            console.error(
                "Send Message Error:",
                result
            );

            return null;

        }


        return result.message || null;

    }

    catch (error) {

        console.error(
            "Send Message Error:",
            error
        );

        return null;

    }

}


// ===================================
// ADMIN LOGIN CHECK
// ===================================

function checkAdmin() {

    const admin =
        localStorage.getItem(
            "lspdAdmin"
        );


    if (admin !== "true") {

        window.location.href =
            "login.html";

        return false;

    }


    return true;

}


// ===================================
// ADMIN LOGIN
// ===================================

function loginAdmin() {

    localStorage.setItem(
        "lspdAdmin",
        "true"
    );

}


// ===================================
// ADMIN LOGOUT
// ===================================

function logoutAdmin() {

    localStorage.removeItem(
        "lspdAdmin"
    );


    window.location.href =
        "login.html";

}


// ===================================
// HTML ESCAPE
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
// REQUEST TYPE TEXT
// ===================================

function getRequestTypeText(type) {

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
// STATUS TEXT
// ===================================

function getStatusText(status) {

    switch (status) {

        case "Accepted":
            return "🟢 تایید شده";

        case "Rejected":
            return "🔴 رد شده";

        default:
            return "🟡 در انتظار بررسی";

    }

}


// ===================================
// STATUS CLASS
// ===================================

function getStatusClass(status) {

    switch (status) {

        case "Accepted":
            return "approved-text";

        case "Rejected":
            return "rejected-text";

        default:
            return "pending-text";

    }

}


// ===================================
// SERVER STATUS
// ===================================

async function checkServer() {

    try {

        const response =
            await fetch(
                API_URL + "/tickets",
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        return response.ok;

    }

    catch (error) {

        console.error(
            "Server Check Error:",
            error
        );

        return false;

    }

}


// ===================================
// CONSOLE
// ===================================

console.log(
    "🚔 Vanguard LSPD System Online"
);

console.log(
    "API:",
    API_URL
);
