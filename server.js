// ===================================
// Vanguard LSPD System
// Secure MongoDB Ticket Server
// ===================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();


// ===================================
// MIDDLEWARE
// ===================================

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));


// ===================================
// HOME
// ===================================

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "index.html")
    );
});


// ===================================
// MONGODB
// ===================================

const MONGO_URI =
    process.env.MONGODB_URI;

if (!MONGO_URI) {

    console.error(
        "❌ MONGODB_URI در Environment Variables تنظیم نشده است."
    );

    process.exit(1);
}


const client =
    new MongoClient(MONGO_URI);


let tickets;
let logs;


// ===================================
// HELPERS
// ===================================

function text(value) {

    return String(
        value ?? ""
    ).trim();

}


function safeObjectId(id) {

    return ObjectId.isValid(id)
        ? new ObjectId(id)
        : null;

}


function createToken() {

    return crypto
        .randomBytes(32)
        .toString("hex");

}


// ===================================
// COMMAND STAFF
// ===================================
//
// این اطلاعات را بهتر است در Environment
// Variables قرار بدهی.
//
// COMMAND_USER
// COMMAND_PASSWORD
// OWNER_USER
// OWNER_PASSWORD
//
// اگر Environment تنظیم نشده باشد، مقادیر
// پیش‌فرض پایین استفاده می‌شوند.
//

const COMMAND_USER =
    process.env.COMMAND_USER ||
    "LSPD";


const COMMAND_PASSWORD =
    process.env.COMMAND_PASSWORD ||
    "LSPD00078";


const OWNER_USER =
    process.env.OWNER_USER ||
    "SEDJAVAD";


const OWNER_PASSWORD =
    process.env.OWNER_PASSWORD ||
    "SEDJAVAD00078";


// ===================================
// STAFF LOGIN
// ===================================

const staffAccounts = {

    LSPD: {

        username: COMMAND_USER,

        password: COMMAND_PASSWORD,

        name: "LSPD Command",

        rank: "Command",

        role: "command"

    },

    SEDJAVAD: {

        username: OWNER_USER,

        password: OWNER_PASSWORD,

        name: "SEDJAVAD",

        rank: "Owner",

        role: "owner"

    }

};


// ===================================
// AUTHENTICATION
// ===================================

const sessions =
    new Map();


function authenticateStaff(
    username,
    password
) {

    const user =
        text(username);

    const pass =
        text(password);


    for (
        const key of Object.keys(staffAccounts)
    ) {

        const account =
            staffAccounts[key];


        if (
            account.username === user &&
            account.password === pass
        ) {

            return account;

        }

    }


    return null;

}


function getStaffFromToken(
    token
) {

    if (!token) {
        return null;
    }


    return sessions.get(token) || null;

}


function requireStaff(
    req,
    res,
    next
) {

    const token =
        text(
            req.headers.authorization
        ).replace(
            /^Bearer\s+/i,
            ""
        );


    const staff =
        getStaffFromToken(token);


    if (!staff) {

        return res.status(401).json({

            success: false,

            message:
                "دسترسی فرماندهی مورد نیاز است."

        });

    }


    req.staff = staff;

    req.authToken = token;

    next();

}


function requireOwner(
    req,
    res,
    next
) {

    if (
        !req.staff ||
        req.staff.role !== "owner"
    ) {

        return res.status(403).json({

            success: false,

            message:
                "این بخش فقط برای Owner قابل دسترسی است."

        });

    }


    next();

}


// ===================================
// CREATE LOG
// ===================================

async function createLog({

    action,

    ticketId = null,

    staff = null,

    details = {}

}) {

    try {

        await logs.insertOne({

            action,

            ticketId:
                ticketId
                ? String(ticketId)
                : null,

            staff: staff
                ? {

                    username:
                        staff.username,

                    name:
                        staff.name,

                    rank:
                        staff.rank,

                    role:
                        staff.role

                }
                : null,

            details,

            createdAt:
                new Date()

        });

    } catch (error) {

        console.error(
            "Create Log Error:",
            error
        );

    }

}


// ===================================
// START SERVER
// ===================================

async function startServer() {

    try {

        await client.connect();


        console.log(
            "MongoDB Connected ✅"
        );


        const database =
            client.db("LSPD");


        tickets =
            database.collection(
                "tickets"
            );


        logs =
            database.collection(
                "logs"
            );


        // ===================================
        // INDEXES
        // ===================================

        try {

            await logs.createIndex({
                createdAt: -1
            });


            await tickets.createIndex({
                createdAt: -1
            });

        } catch (error) {

            console.error(
                "Index Error:",
                error
            );

        }


        // ===================================
        // STAFF LOGIN
        // ===================================

        app.post(
            "/auth/login",
            async (req, res) => {

                try {

                    const username =
                        text(
                            req.body.username
                        );


                    const password =
                        text(
                            req.body.password
                        );


                    const staff =
                        authenticateStaff(
                            username,
                            password
                        );


                    if (!staff) {

                        await createLog({

                            action:
                                "login_failed",

                            details: {

                                username

                            }

                        });


                        return res.status(
                            401
                        ).json({

                            success: false,

                            message:
                                "نام کاربری یا رمز عبور اشتباه است."

                        });

                    }


                    const token =
                        createToken();


                    sessions.set(
                        token,
                        staff
                    );


                    await createLog({

                        action:
                            "login",

                        staff,

                        details: {

                            message:
                                "ورود موفق فرماندهی"

                        }

                    });


                    res.json({

                        success: true,

                        token,

                        staff: {

                            username:
                                staff.username,

                            name:
                                staff.name,

                            rank:
                                staff.rank,

                            role:
                                staff.role

                        }

                    });

                } catch (error) {

                    console.error(
                        "LOGIN ERROR:",
                        error
                    );


                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در ورود"

                    });

                }

            }
        );


        // ===================================
        // LOGOUT
        // ===================================

        app.post(
            "/auth/logout",
            requireStaff,
            async (req, res) => {

                await createLog({

                    action:
                        "logout",

                    staff:
                        req.staff

                });


                sessions.delete(
                    req.authToken
                );


                res.json({

                    success: true

                });

            }
        );


        // ===================================
        // CURRENT STAFF
        // ===================================

        app.get(
            "/auth/me",
            requireStaff,
            (req, res) => {

                res.json({

                    success: true,

                    staff: {

                        username:
                            req.staff.username,

                        name:
                            req.staff.name,

                        rank:
                            req.staff.rank,

                        role:
                            req.staff.role

                    }

                });

            }
        );


        // ===================================
        // GET ALL TICKETS
        // ===================================

        app.get(
            "/tickets",
            requireStaff,
            async (req, res) => {

                try {

                    const data =
                        await tickets
                            .find({})
                            .sort({
                                createdAt: -1
                            })
                            .toArray();


                    res.json(data);

                } catch (error) {

                    console.error(
                        "GET /tickets Error:",
                        error
                    );


                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در دریافت درخواست‌ها"

                    });

                }

            }
        );


        // ===================================
        // GET SINGLE TICKET
        // ===================================

        app.get(
            "/tickets/:id",
            async (req, res) => {

                try {

                    const id =
                        safeObjectId(
                            req.params.id
                        );


                    if (!id) {

                        return res.status(
                            400
                        ).json({

                            success: false,

                            message:
                                "کد پیگیری نامعتبر است."

                        });

                    }


                    const ticket =
                        await tickets.findOne({
                            _id: id
                        });


                    if (!ticket) {

                        return res.status(
                            404
                        ).json({

                            success: false,

                            message:
                                "درخواست پیدا نشد."

                        });

                    }


                    res.json(ticket);

                } catch (error) {

                    console.error(
                        "GET SINGLE TICKET Error:",
                        error
                    );


                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در دریافت درخواست"

                    });

                }

            }
        );


        // ===================================
        // CREATE NEW TICKET
        // ===================================

        app.post(
            "/tickets",
            async (req, res) => {

                try {

                    const body =
                        req.body || {};


                    const requestType =
                        text(
                            body.requestType ||
                            body.type ||
                            "membership"
                        );


                    let score = null;


                    if (
                        body.score !== undefined &&
                        body.score !== null &&
                        body.score !== ""
                    ) {

                        const numberScore =
                            Number(
                                body.score
                            );


                        if (
                            Number.isFinite(
                                numberScore
                            ) &&
                            numberScore >= 0 &&
                            numberScore <= 20
                        ) {

                            score =
                                numberScore;

                        }

                    }


                    const passed =
                        body.passed === true ||
                        (
                            score !== null &&
                            score >= 12
                        );


                    const ticket = {

                        requestType,

                        ocName:
                            text(body.ocName),

                        icName:
                            text(
                                body.icName ||
                                body.name
                            ),

                        name:
                            text(
                                body.icName ||
                                body.name
                            ),

                        discord:
                            text(
                                body.discord ||
                                body.discordId
                            ),

                        discordId:
                            text(
                                body.discordId ||
                                body.discord
                            ),

                        steamHex:
                            text(body.steamHex),

                        cmx:
                            text(body.cmx),

                        age:
                            text(body.age),


                        experience:
                            text(
                                body.experience
                            ),

                        reason:
                            text(body.reason),


                        currentDivision:
                            text(
                                body.currentDivision
                            ),

                        requestedDivision:
                            text(
                                body.requestedDivision
                            ),

                        reasonForRequest:
                            text(
                                body.reasonForRequest
                            ),

                        previousDivisionExperience:
                            text(
                                body.previousDivisionExperience
                            ),

                        additionalInformation:
                            text(
                                body.additionalInformation
                            ),


                        oocName:
                            text(body.oocName),

                        rank:
                            text(body.rank),

                        callSign:
                            text(body.callSign),

                        resignationReason:
                            text(
                                body.resignationReason ||
                                body.reason
                            ),


                        requestRank:
                            text(
                                body.requestRank
                            ),

                        currentRankTimeplay:
                            text(
                                body.currentRankTimeplay
                            ),

                        note:
                            text(body.note),


                        score,

                        passed,

                        passingScore: 12,


                        status:
                            "Pending",


                        reply:
                            "در انتظار پاسخ فرماندهی",


                        messages: [],


                        createdAt:
                            new Date(),

                        updatedAt:
                            new Date()

                    };


                    const result =
                        await tickets.insertOne(
                            ticket
                        );


                    const ticketId =
                        result.insertedId.toString();


                    await createLog({

                        action:
                            "ticket_created",

                        ticketId,

                        details: {

                            requestType,

                            applicant:

                                ticket.icName ||
                                ticket.name ||
                                ticket.ocName,

                            discord:
                                ticket.discord

                        }

                    });


                    console.log(
                        "New Ticket:",
                        ticketId
                    );


                    res.json({

                        success: true,

                        id:
                            ticketId,

                        score,

                        passed

                    });

                } catch (error) {

                    console.error(
                        "POST /tickets Error:",
                        error
                    );


                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در ثبت درخواست"

                    });

                }

            }
        );


        // ===================================
        // UPDATE TICKET
        // ===================================

        app.put(
            "/tickets/:id",
            requireStaff,
            async (req, res) => {

                try {

                    const id =
                        safeObjectId(
                            req.params.id
                        );


                    if (!id) {

                        return res.status(
                            400
                        ).json({

                            success: false,

                            message:
                                "شناسه تیکت نامعتبر است"

                        });

                    }


                    const oldTicket =
                        await tickets.findOne({
                            _id: id
                        });


                    if (!oldTicket) {

                        return res.status(
                            404
                        ).json({

                            success: false,

                            message:
                                "درخواست پیدا نشد"

                        });

                    }


                    const status =
                        text(
                            req.body.status
                        ) || "Pending";


                    const reply =
                        text(
                            req.body.reply
                        );


                    const result =
                        await tickets.updateOne(

                            {
                                _id: id
                            },

                            {

                                $set: {

                                    status,

                                    reply,

                                    updatedAt:
                                        new Date()

                                }

                            }

                        );


                    if (
                        !result.matchedCount
                    ) {

                        return res.status(
                            404
                        ).json({

                            success: false,

                            message:
                                "درخواست پیدا نشد"

                        });

                    }


                    // ===================================
                    // LOG REPLY
                    // ===================================

                    await createLog({

                        action:
                            "ticket_replied",

                        ticketId:
                            id.toString(),

                        staff:
                            req.staff,

                        details: {

                            status,

                            reply,

                            applicant:

                                oldTicket.icName ||
                                oldTicket.name ||
                                oldTicket.ocName,

                            requestType:
                                oldTicket.requestType

                        }

                    });


                    res.json({

                        success: true

                    });

                } catch (error) {

                    console.error(
                        "PUT /tickets Error:",
                        error
                    );


                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در بروزرسانی تیکت"

                    });

                }

            }
        );


        // ===================================
        // GET CHAT MESSAGES
        // ===================================

        app.get(
            "/tickets/:id/messages",
            async (req, res) => {

                try {

                    const id =
                        safeObjectId(
                            req.params.id
                        );


                    if (!id) {

                        return res.status(
                            400
                        ).json({

                            success: false,

                            message:
                                "کد پیگیری نامعتبر است"

                        });

                    }


                    const ticket =
                        await tickets.findOne(

                            {
                                _id: id
                            },

                            {
                                projection: {

                                    messages: 1

                                }

                            }

                        );


                    if (!ticket) {

                        return res.status(
                            404
                        ).json({

                            success: false,

                            message:
                                "درخواست پیدا نشد"

                        });

                    }


                    res.json(
                        ticket.messages || []
                    );

                } catch (error) {

                    console.error(
                        "GET MESSAGES Error:",
                        error
                    );


                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در دریافت چت"

                    });

                }

            }
        );


        // ===================================
        // SEND CHAT MESSAGE
        // ===================================

        app.post(
            "/tickets/:id/messages",
            async (req, res) => {

                try {

                    const id =
                        safeObjectId(
                            req.params.id
                        );


                    if (!id) {

                        return res.status(
                            400
                        ).json({

                            success: false,

                            message:
                                "کد پیگیری نامعتبر است"

                        });

                    }


                    const message =
                        text(
                            req.body.message
                        );


                    if (!message) {

                        return res.status(
                            400
                        ).json({

                            success: false,

                            message:
                                "پیام نمی‌تواند خالی باشد"

                        });

                    }


                    if (
                        message.length > 2000
                    ) {

                        return res.status(
                            400
                        ).json({

                            success: false,

                            message:
                                "پیام بیش از حد طولانی است"

                        });

                    }


                    let sender =
                        text(
                            req.body.sender
                        );


                    if (
                        sender !== "command" &&
                        sender !== "applicant"
                    ) {

                        sender =
                            "applicant";

                    }


                    const chatMessage = {

                        sender,

                        message,

                        createdAt:
                            new Date()

                    };


                    // اگر پیام از فرمانده باشد
                    // مشخصات فرمانده را هم ذخیره می‌کنیم.

                    if (
                        sender === "command"
                    ) {

                        const token =
                            text(
                                req.headers.authorization
                            ).replace(
                                /^Bearer\s+/i,
                                ""
                            );


                        const staff =
                            getStaffFromToken(
                                token
                            );


                        if (!staff) {

                            return res.status(
                                401
                            ).json({

                                success: false,

                                message:
                                    "برای ارسال پیام فرماندهی وارد شوید."

                            });

                        }


                        chatMessage.staff = {

                            username:
                                staff.username,

                            name:
                                staff.name,

                            rank:
                                staff.rank,

                            role:
                                staff.role

                        };


                        await createLog({

                            action:
                                "chat_message_command",

                            ticketId:
                                id.toString(),

                            staff,

                            details: {

                                message

                            }

                        });

                    } else {

                        await createLog({

                            action:
                                "chat_message_applicant",

                            ticketId:
                                id.toString(),

                            details: {

                                message

                            }

                        });

                    }


                    const result =
                        await tickets.updateOne(

                            {
                                _id: id
                            },

                            {

                                $push: {

                                    messages:
                                        chatMessage

                                },

                                $set: {

                                    updatedAt:
                                        new Date()

                                }

                            }

                        );


                    if (
                        !result.matchedCount
                    ) {

                        return res.status(
                            404
                        ).json({

                            success: false,

                            message:
                                "درخواست پیدا نشد"

                        });

                    }


                    res.json({

                        success: true,

                        message:
                            chatMessage

                    });

                } catch (error) {

                    console.error(
                        "POST MESSAGE Error:",
                        error
                    );


                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در ارسال پیام"

                    });

                }

            }
        );


        // ===================================
        // OWNER - GET LOGS
        // ===================================

        app.get(
            "/admin/logs",
            requireStaff,
            requireOwner,
            async (req, res) => {

                try {

                    const limit =
                        Math.min(
                            Number(
                                req.query.limit
                            ) || 200,
                            1000
                        );


                    const data =
                        await logs
                            .find({})
                            .sort({
                                createdAt: -1
                            })
                            .limit(limit)
                            .toArray();


                    res.json({

                        success: true,

                        logs: data

                    });

                } catch (error) {

                    console.error(
                        "GET LOGS Error:",
                        error
                    );


                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در دریافت لاگ‌ها"

                    });

                }

            }
        );


        // ===================================
        // OWNER - DELETE TICKET
        // ===================================

        app.delete(
            "/tickets/:id",
            requireStaff,
            requireOwner,
            async (req, res) => {

                try {

                    const id =
                        safeObjectId(
                            req.params.id
                        );


                    if (!id) {

                        return res.status(
                            400
                        ).json({

                            success: false,

                            message:
                                "شناسه تیکت نامعتبر است"

                        });

                    }


                    const oldTicket =
                        await tickets.findOne({
                            _id: id
                        });


                    if (!oldTicket) {

                        return res.status(
                            404
                        ).json({

                            success: false,

                            message:
                                "تیکت پیدا نشد"

                        });

                    }


                    const result =
                        await tickets.deleteOne({

                            _id: id

                        });


                    if (
                        result.deletedCount === 0
                    ) {

                        return res.status(
                            404
                        ).json({

                            success: false,

                            message:
                                "تیکت پیدا نشد"

                        });

                    }


                    await createLog({

                        action:
                            "ticket_deleted",

                        ticketId:
                            id.toString(),

                        staff:
                            req.staff,

                        details: {

                            applicant:

                                oldTicket.icName ||
                                oldTicket.name ||
                                oldTicket.ocName,

                            requestType:
                                oldTicket.requestType,

                            status:
                                oldTicket.status

                        }

                    });


                    res.json({

                        success: true

                    });

                } catch (error) {

                    console.error(
                        "DELETE TICKET Error:",
                        error
                    );


                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در حذف تیکت"

                    });

                }

            }
        );


        // ===================================
        // SERVER
        // ===================================

        const PORT =
            process.env.PORT || 3000;


        app.listen(
            PORT,
            () => {

                console.log(
                    `🚔 Vanguard LSPD Server running on port ${PORT}`
                );

            }
        );

    } catch (error) {

        console.error(
            "❌ MongoDB Connection Error:",
            error
        );

        process.exit(1);

    }

}


// ===================================
// RUN
// ===================================

startServer();
