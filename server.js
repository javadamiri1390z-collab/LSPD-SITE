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

app.use(
    express.json({
        limit: "1mb"
    })
);

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
// AUTH TOKENS
// ===================================
//
// Tokenها موقت هستند و با Restart سرور
// دوباره باید Login انجام شود.
//

const sessions = new Map();


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


function generateToken() {

    return crypto
        .randomBytes(32)
        .toString("hex");

}


function getBearerToken(req) {

    const header =
        req.headers.authorization || "";

    if (
        !header.startsWith("Bearer ")
    ) {

        return null;

    }

    return header.substring(7).trim();

}


function getSession(req) {

    const token =
        getBearerToken(req);

    if (!token) {

        return null;

    }

    return sessions.get(token) || null;

}


// ===================================
// AUTH MIDDLEWARE
// ===================================

function requireAuth(req, res, next) {

    const session =
        getSession(req);

    if (!session) {

        return res.status(401).json({

            success: false,

            message:
                "دسترسی غیرمجاز. ابتدا وارد شوید."

        });

    }

    req.user =
        session;

    next();

}


function requireCommand(req, res, next) {

    const session =
        getSession(req);

    if (!session) {

        return res.status(401).json({

            success: false,

            message:
                "ابتدا وارد حساب فرماندهی شوید."

        });

    }


    if (
        session.role !== "command" &&
        session.role !== "admin"
    ) {

        return res.status(403).json({

            success: false,

            message:
                "شما دسترسی فرماندهی ندارید."

        });

    }


    req.user =
        session;

    next();

}


function requireAdmin(req, res, next) {

    const session =
        getSession(req);

    if (!session) {

        return res.status(401).json({

            success: false,

            message:
                "ابتدا وارد حساب شوید."

        });

    }


    if (
        session.role !== "admin"
    ) {

        return res.status(403).json({

            success: false,

            message:
                "فقط مدیر اصلی به این بخش دسترسی دارد."

        });

    }


    req.user =
        session;

    next();

}


// ===================================
// LOG HELPER
// ===================================

async function createLog({

    action,
    ticketId = null,
    actorType = "system",
    username = "system",
    name = "System",
    rank = "System",
    details = ""

}) {

    try {

        if (!logs) {

            return;

        }


        await logs.insertOne({

            action,

            ticketId:
                ticketId
                    ? String(ticketId)
                    : null,

            actor: {

                type:
                    actorType,

                username:
                    text(username),

                name:
                    text(name),

                rank:
                    text(rank)

            },

            details:
                text(details),

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
// AUTH LOGIN
// ===================================

app.post(
    "/auth/login",
    async (req, res) => {

        try {

            const username =
                text(req.body.username);

            const password =
                text(req.body.password);


            if (
                !username ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "نام کاربری و رمز عبور الزامی است."

                });

            }


            const commandUsername =
                text(
                    process.env.COMMAND_USERNAME
                ) || "LSPD";


            const commandPassword =
                text(
                    process.env.COMMAND_PASSWORD
                ) || "LSPD00078";


            const adminUsername =
                text(
                    process.env.ADMIN_USERNAME
                ) || "SEDJAVAD";


            const adminPassword =
                text(
                    process.env.ADMIN_PASSWORD
                ) || "SEDJAVAD00078";


            let role = null;
            let rank = null;


            // ===================================
            // ADMIN
            // ===================================

            if (
                username === adminUsername &&
                password === adminPassword
            ) {

                role = "admin";

                rank =
                    process.env.ADMIN_RANK ||
                    "Chief";


            // ===================================
            // COMMAND
            // ===================================

            } else if (
                username === commandUsername &&
                password === commandPassword
            ) {

                role = "command";

                rank =
                    process.env.COMMAND_RANK ||
                    "Commander";

            }


            if (!role) {

                return res.status(401).json({

                    success: false,

                    message:
                        "نام کاربری یا رمز عبور اشتباه است."

                });

            }


            const token =
                generateToken();


            const user = {

                role,

                username,

                rank,

                name:
                    username,

                loginAt:
                    new Date()

            };


            sessions.set(
                token,
                user
            );


            await createLog({

                action:
                    "login",

                actorType:
                    role,

                username,

                name:
                    username,

                rank,

                details:
                    "ورود موفق به سیستم"

            });


            return res.json({

                success: true,

                token,

                user: {

                    username,

                    name:
                        username,

                    rank,

                    role

                }

            });

        } catch (error) {

            console.error(
                "AUTH LOGIN ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطا در ورود"

            });

        }

    }
);


// ===================================
// AUTH ME
// ===================================

app.get(
    "/auth/me",
    requireAuth,
    (req, res) => {

        res.json({

            success: true,

            user: req.user

        });

    }
);


// ===================================
// LOGOUT
// ===================================

app.post(
    "/auth/logout",
    requireAuth,
    (req, res) => {

        const token =
            getBearerToken(req);

        if (token) {

            sessions.delete(token);

        }


        res.json({

            success: true

        });

    }
);


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
            database.collection("tickets");


        logs =
            database.collection("logs");


        // ===================================
        // INDEXES
        // ===================================

        try {

            await tickets.createIndex({
                createdAt: -1
            });


            await tickets.createIndex({
                updatedAt: -1
            });


            await logs.createIndex({
                createdAt: -1
            });


            await logs.createIndex({
                ticketId: 1
            });

        } catch (indexError) {

            console.error(
                "Index Error:",
                indexError
            );

        }


        // ===================================
        // GET ALL TICKETS
        // ===================================
        //
        // فقط فرماندهی و Admin
        //

        app.get(
            "/tickets",
            requireCommand,
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
        //
        // عمومی است تا صفحه Tracking کار کند
        //

        app.get(
            "/tickets/:id",
            async (req, res) => {

                try {

                    const id =
                        safeObjectId(
                            req.params.id
                        );


                    if (!id) {

                        return res.status(400).json({

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

                        return res.status(404).json({

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


                    // ===================================
                    // SCORE
                    // ===================================

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


                    // ===================================
                    // TICKET
                    // ===================================

                    const ticket = {

                        requestType,

                        ocName:
                            text(
                                body.ocName
                            ),

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
                            text(
                                body.steamHex
                            ),

                        cmx:
                            text(
                                body.cmx
                            ),

                        age:
                            text(
                                body.age
                            ),


                        // MEMBERSHIP

                        experience:
                            text(
                                body.experience
                            ),

                        reason:
                            text(
                                body.reason
                            ),


                        // DIVISION

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


                        // RESIGNATION

                        oocName:
                            text(
                                body.oocName
                            ),

                        rank:
                            text(
                                body.rank
                            ),

                        callSign:
                            text(
                                body.callSign
                            ),

                        resignationReason:
                            text(
                                body.resignationReason ||
                                body.reason
                            ),


                        // RANK UP

                        requestRank:
                            text(
                                body.requestRank
                            ),

                        currentRankTimeplay:
                            text(
                                body.currentRankTimeplay
                            ),

                        note:
                            text(
                                body.note
                            ),


                        // EXAM

                        score,

                        passed,

                        passingScore:
                            12,


                        // STATUS

                        status:
                            "Pending",


                        // REPLY

                        reply:
                            "در انتظار پاسخ فرماندهی",


                        // CHAT

                        messages: [],


                        // DATES

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


                    console.log(
                        "New Ticket:",
                        ticketId,
                        "| Type:",
                        requestType,
                        "| Score:",
                        score
                    );


                    // ===================================
                    // AUTO LOG
                    // ===================================

                    await createLog({

                        action:
                            "ticket_created",

                        ticketId,

                        actorType:
                            "applicant",

                        username:
                            ticket.discord ||

                            ticket.discordId ||

                            "applicant",

                        name:
                            ticket.icName ||

                            ticket.name ||

                            ticket.ocName ||

                            "Applicant",

                        rank:
                            "Applicant",

                        details:
                            `درخواست جدید ثبت شد | نوع: ${requestType}`

                    });


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
        //
        // فقط Command / Admin
        //

        app.put(
            "/tickets/:id",
            requireCommand,
            async (req, res) => {

                try {

                    const id =
                        safeObjectId(
                            req.params.id
                        );


                    if (!id) {

                        return res.status(400).json({

                            success: false,

                            message:
                                "شناسه تیکت نامعتبر است"

                        });

                    }


                    const existing =
                        await tickets.findOne({

                            _id: id

                        });


                    if (!existing) {

                        return res.status(404).json({

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


                    if (!result.matchedCount) {

                        return res.status(404).json({

                            success: false,

                            message:
                                "درخواست پیدا نشد"

                        });

                    }


                    // ===================================
                    // AUTO LOG UPDATE
                    // ===================================

                    await createLog({

                        action:
                            "ticket_updated",

                        ticketId:
                            id.toString(),

                        actorType:
                            req.user.role,

                        username:
                            req.user.username,

                        name:
                            req.user.name,

                        rank:
                            req.user.rank,

                        details:
                            `تیکت بروزرسانی شد | وضعیت: ${status}`

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
        //
        // عمومی است تا Tracking کار کند
        //

        app.get(
            "/tickets/:id/messages",
            async (req, res) => {

                try {

                    const id =
                        safeObjectId(
                            req.params.id
                        );


                    if (!id) {

                        return res.status(400).json({

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

                        return res.status(404).json({

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
        //
        // Applicant:
        // بدون Login
        //
        // Command/Admin:
        // حتماً Login لازم دارد
        //

        app.post(
            "/tickets/:id/messages",
            async (req, res) => {

                try {

                    const id =
                        safeObjectId(
                            req.params.id
                        );


                    if (!id) {

                        return res.status(400).json({

                            success: false,

                            message:
                                "کد پیگیری نامعتبر است"

                        });

                    }


                    const ticket =
                        await tickets.findOne({

                            _id: id

                        });


                    if (!ticket) {

                        return res.status(404).json({

                            success: false,

                            message:
                                "درخواست پیدا نشد"

                        });

                    }


                    const message =
                        text(
                            req.body.message
                        );


                    let sender =
                        text(
                            req.body.sender
                        );


                    if (!message) {

                        return res.status(400).json({

                            success: false,

                            message:
                                "پیام نمی‌تواند خالی باشد"

                        });

                    }


                    if (
                        message.length > 2000
                    ) {

                        return res.status(400).json({

                            success: false,

                            message:
                                "پیام بیش از حد طولانی است"

                        });

                    }


                    // ===================================
                    // COMMAND MESSAGE
                    // ===================================

                    if (
                        sender === "command"
                    ) {

                        const session =
                            getSession(req);


                        if (!session) {

                            return res.status(401).json({

                                success: false,

                                message:
                                    "برای ارسال پیام فرماندهی ابتدا وارد شوید."

                            });

                        }


                        if (
                            session.role !== "command" &&
                            session.role !== "admin"
                        ) {

                            return res.status(403).json({

                                success: false,

                                message:
                                    "شما اجازه ارسال پیام فرماندهی ندارید."

                            });

                        }


                        const chatMessage = {

                            sender:
                                "command",

                            message,

                            username:
                                session.username,

                            name:
                                session.name,

                            rank:
                                session.rank,

                            role:
                                session.role,

                            createdAt:
                                new Date()

                        };


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


                        // ===================================
                        // AUTO LOG COMMAND
                        // ===================================

                        await createLog({

                            action:
                                "command_message",

                            ticketId:
                                id.toString(),

                            actorType:
                                session.role,

                            username:
                                session.username,

                            name:
                                session.name,

                            rank:
                                session.rank,

                            details:
                                `فرمانده پیام ارسال کرد: ${message}`

                        });


                        return res.json({

                            success: true,

                            message:
                                chatMessage

                        });

                    }


                    // ===================================
                    // APPLICANT MESSAGE
                    // ===================================

                    sender =
                        "applicant";


                    const applicantName =
                        text(
                            ticket.icName ||
                            ticket.name ||
                            ticket.ocName
                        ) ||
                        "Applicant";


                    const applicantUsername =
                        text(
                            ticket.discord ||
                            ticket.discordId
                        ) ||
                        "Applicant";


                    const chatMessage = {

                        sender:
                            "applicant",

                        message,

                        username:
                            applicantUsername,

                        name:
                            applicantName,

                        rank:
                            "Applicant",

                        role:
                            "applicant",

                        createdAt:
                            new Date()

                    };


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


                    // ===================================
                    // AUTO LOG APPLICANT
                    // ===================================

                    await createLog({

                        action:
                            "applicant_message",

                        ticketId:
                            id.toString(),

                        actorType:
                            "applicant",

                        username:
                            applicantUsername,

                        name:
                            applicantName,

                        rank:
                            "Applicant",

                        details:
                            `متقاضی پیام ارسال کرد: ${message}`

                    });


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
        // DELETE TICKET
        // ===================================
        //
        // فقط SEDJAVAD / ADMIN
        //

        app.delete(
            "/tickets/:id",
            requireAdmin,
            async (req, res) => {

                try {

                    const id =
                        safeObjectId(
                            req.params.id
                        );


                    if (!id) {

                        return res.status(400).json({

                            success: false,

                            message:
                                "شناسه تیکت نامعتبر است"

                        });

                    }


                    const ticket =
                        await tickets.findOne({

                            _id: id

                        });


                    if (!ticket) {

                        return res.status(404).json({

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

                        return res.status(404).json({

                            success: false,

                            message:
                                "تیکت حذف نشد"

                        });

                    }


                    // ===================================
                    // AUTO LOG DELETE
                    // ===================================

                    await createLog({

                        action:
                            "ticket_deleted",

                        ticketId:
                            id.toString(),

                        actorType:
                            req.user.role,

                        username:
                            req.user.username,

                        name:
                            req.user.name,

                        rank:
                            req.user.rank,

                        details:
                            `تیکت ${id.toString()} حذف شد | متقاضی: ${
                                ticket.icName ||
                                ticket.name ||
                                ticket.ocName ||
                                "Unknown"
                            }`

                    });


                    res.json({

                        success: true

                    });

                } catch (error) {

                    console.error(
                        "DELETE /tickets Error:",
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
        // GET LOGS
        // ===================================
        //
        // فقط Admin
        //

        app.get(
            "/admin/logs",
            requireAdmin,
            async (req, res) => {

                try {

                    const limit =
                        Math.min(

                            Math.max(

                                Number(
                                    req.query.limit
                                ) || 200,

                                1

                            ),

                            500

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

                        logs:
                            data

                    });

                } catch (error) {

                    console.error(
                        "GET ADMIN LOGS Error:",
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
        // GET LOGS FOR ONE TICKET
        // ===================================
        //
        // فقط Admin
        //

        app.get(
            "/admin/logs/:ticketId",
            requireAdmin,
            async (req, res) => {

                try {

                    const ticketId =
                        text(
                            req.params.ticketId
                        );


                    const data =
                        await logs
                            .find({
                                ticketId
                            })
                            .sort({
                                createdAt: 1
                            })
                            .toArray();


                    res.json({

                        success: true,

                        logs:
                            data

                    });

                } catch (error) {

                    console.error(
                        "GET TICKET LOGS Error:",
                        error
                    );


                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در دریافت لاگ تیکت"

                    });

                }

            }
        );


        // ===================================
        // DELETE LOGS
        // ===================================
        //
        // فقط Admin
        //

        app.delete(
            "/admin/logs",
            requireAdmin,
            async (req, res) => {

                try {

                    await logs.deleteMany({});


                    await createLog({

                        action:
                            "logs_cleared",

                        actorType:
                            req.user.role,

                        username:
                            req.user.username,

                        name:
                            req.user.name,

                        rank:
                            req.user.rank,

                        details:
                            "تمام لاگ‌ها پاک شدند."

                    });


                    res.json({

                        success: true

                    });

                } catch (error) {

                    console.error(
                        "DELETE LOGS Error:",
                        error
                    );


                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در پاک کردن لاگ‌ها"

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

                console.log(
                    "🔐 Authentication system enabled"
                );

                console.log(
                    "👮 Command role enabled"
                );

                console.log(
                    "👑 Admin role enabled"
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
