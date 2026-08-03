// ===============================================
// VANGUARD LSPD
// Secure Ticket + Command + Super Admin Server
// MongoDB
// ===============================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();


// =================================================
// CONFIG
// =================================================

const PORT = process.env.PORT || 3000;

const MONGO_URI = process.env.MONGODB_URI;

const TOKEN_SECRET =
    process.env.LSPD_TOKEN_SECRET ||
    "VANGUARD_LSPD_CHANGE_THIS_SECRET_2026";


// =================================================
// COMMAND USERS
// =================================================
// بعداً بهتر است Passwordها را به Environment Variables منتقل کنیم.
// فعلاً برای هماهنگی با سیستم فعلی شما همین اطلاعات استفاده شده.
// =================================================

const COMMAND_USERS = {

    LSPD: {

        username: "LSPD",

        password: "LSPD00078",

        name: "Vanguard Commander",

        rank: "Commander",

        role: "command"

    },


    SEDJAVAD: {

        username: "SEDJAVAD",

        password: "SEDJAVAD00078",

        name: "SEDJAVAD",

        rank: "Chief of Police",

        role: "superadmin"

    }

};


// =================================================
// MIDDLEWARE
// =================================================

app.use(

    cors({

        origin: true,

        credentials: true

    })

);

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(express.static(__dirname));


// =================================================
// DATABASE
// =================================================

if (!MONGO_URI) {

    console.error(
        "❌ MONGODB_URI تنظیم نشده است."
    );

    process.exit(1);

}


const client =
    new MongoClient(MONGO_URI);


let database;

let tickets;

let logs;


// =================================================
// HELPERS
// =================================================

function text(value) {

    return String(value ?? "").trim();

}


function safeObjectId(id) {

    if (!ObjectId.isValid(id)) {

        return null;

    }

    return new ObjectId(id);

}


function escapeLogText(value) {

    return text(value).slice(0, 5000);

}


// =================================================
// TOKEN SYSTEM
// =================================================

function createToken(user) {

    const payload = {

        username: user.username,

        name: user.name,

        rank: user.rank,

        role: user.role,

        createdAt: Date.now(),

        expiresAt:
            Date.now() +
            (12 * 60 * 60 * 1000)

    };


    const encoded =
        Buffer
            .from(JSON.stringify(payload))
            .toString("base64url");


    const signature =
        crypto
            .createHmac(
                "sha256",
                TOKEN_SECRET
            )
            .update(encoded)
            .digest("base64url");


    return `${encoded}.${signature}`;

}


function verifyToken(token) {

    try {

        if (!token) {

            return null;

        }


        const parts =
            token.split(".");


        if (parts.length !== 2) {

            return null;

        }


        const encoded =
            parts[0];

        const signature =
            parts[1];


        const expectedSignature =
            crypto
                .createHmac(
                    "sha256",
                    TOKEN_SECRET
                )
                .update(encoded)
                .digest("base64url");


        if (
            signature.length !==
            expectedSignature.length
        ) {

            return null;

        }


        if (
            !crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            )
        ) {

            return null;

        }


        const payload =
            JSON.parse(
                Buffer
                    .from(encoded, "base64url")
                    .toString("utf8")
            );


        if (
            !payload.expiresAt ||
            Date.now() > payload.expiresAt
        ) {

            return null;

        }


        return payload;

    } catch (error) {

        return null;

    }

}


// =================================================
// AUTH MIDDLEWARE
// =================================================

function requireCommand(req, res, next) {

    const auth =
        req.headers.authorization || "";


    if (
        !auth.startsWith("Bearer ")
    ) {

        return res.status(401).json({

            success: false,

            message:
                "دسترسی فرماندهی نیاز به ورود دارد."

        });

    }


    const token =
        auth.substring(7);


    const user =
        verifyToken(token);


    if (!user) {

        return res.status(401).json({

            success: false,

            message:
                "نشست شما منقضی شده است. دوباره وارد شوید."

        });

    }


    req.commandUser = user;


    next();

}


function requireSuperAdmin(req, res, next) {

    if (
        !req.commandUser ||
        req.commandUser.role !== "superadmin"
    ) {

        return res.status(403).json({

            success: false,

            message:
                "این بخش فقط برای Super Admin قابل دسترسی است."

        });

    }


    next();

}


// =================================================
// LOG SYSTEM
// =================================================

async function createLog({

    action,

    ticketId = null,

    actorType = "system",

    actorUsername = null,

    actorName = null,

    actorRank = null,

    actorRole = null,

    message = "",

    metadata = {}

}) {

    try {

        const log = {

            action,

            ticketId:
                ticketId
                ? String(ticketId)
                : null,

            actorType,

            actorUsername,

            actorName,

            actorRank,

            actorRole,

            message:
                escapeLogText(message),

            metadata,

            createdAt:
                new Date()

        };


        await logs.insertOne(log);


        console.log(

            "LOG:",

            action,

            "|",

            actorName || actorUsername || actorType,

            "| Ticket:",

            ticketId || "-"

        );

    } catch (error) {

        console.error(
            "❌ Log Error:",
            error
        );

    }

}


// =================================================
// HOME
// =================================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "index.html"
        )
    );

});


// =================================================
// AUTH LOGIN
// =================================================

app.post("/auth/login", async (req, res) => {

    try {

        const username =
            text(req.body.username);

        const password =
            text(req.body.password);


        if (!username || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "نام کاربری و رمز عبور الزامی است."

            });

        }


        const user =
            COMMAND_USERS[username];


        if (
            !user ||
            user.password !== password
        ) {

            await createLog({

                action:
                    "LOGIN_FAILED",

                actorType:
                    "unknown",

                actorUsername:
                    username,

                message:
                    "تلاش ناموفق برای ورود به پنل فرماندهی"

            });


            return res.status(401).json({

                success: false,

                message:
                    "نام کاربری یا رمز عبور اشتباه است."

            });

        }


        const token =
            createToken(user);


        await createLog({

            action:
                "LOGIN_SUCCESS",

            actorType:
                "command",

            actorUsername:
                user.username,

            actorName:
                user.name,

            actorRank:
                user.rank,

            actorRole:
                user.role,

            message:
                "ورود موفق به پنل فرماندهی"

        });


        res.json({

            success: true,

            token,

            user: {

                username:
                    user.username,

                name:
                    user.name,

                rank:
                    user.rank,

                role:
                    user.role

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

});


// =================================================
// CHECK CURRENT SESSION
// =================================================

app.get(
    "/auth/me",
    requireCommand,
    (req, res) => {

        res.json({

            success: true,

            user: {

                username:
                    req.commandUser.username,

                name:
                    req.commandUser.name,

                rank:
                    req.commandUser.rank,

                role:
                    req.commandUser.role

            }

        });

    }
);


// =================================================
// GET ALL TICKETS
// COMMAND ONLY
// =================================================

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
                "GET /tickets ERROR:",
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


// =================================================
// GET SINGLE TICKET
// PUBLIC
// =================================================

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
                "GET SINGLE TICKET ERROR:",
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


// =================================================
// CREATE TICKET
// PUBLIC
// =================================================

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


            // -----------------------------------------
            // SCORE
            // -----------------------------------------

            let score = null;


            if (
                body.score !== undefined &&
                body.score !== null &&
                body.score !== ""
            ) {

                const numberScore =
                    Number(body.score);


                if (
                    Number.isFinite(numberScore) &&
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


            // -----------------------------------------
            // TICKET
            // -----------------------------------------

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
                    text(body.experience),


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
                    text(body.requestRank),


                currentRankTimeplay:
                    text(
                        body.currentRankTimeplay
                    ),


                note:
                    text(body.note),


                score,


                passed,


                passingScore:
                    12,


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
                    "TICKET_CREATED",

                ticketId,

                actorType:
                    "applicant",

                actorName:
                    ticket.icName ||
                    ticket.ocName,

                message:
                    "درخواست جدید ثبت شد.",

                metadata: {

                    requestType,

                    score,

                    passed

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
                "POST /tickets ERROR:",
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


// =================================================
// UPDATE TICKET
// COMMAND ONLY
// =================================================

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
                        "شناسه تیکت نامعتبر است."

                });

            }


            const oldTicket =
                await tickets.findOne({
                    _id: id
                });


            if (!oldTicket) {

                return res.status(404).json({

                    success: false,

                    message:
                        "درخواست پیدا نشد."

                });

            }


            const status =
                text(req.body.status) ||
                oldTicket.status ||
                "Pending";


            const reply =
                text(req.body.reply);


            const updateData = {

                status,

                updatedAt:
                    new Date()

            };


            if (
                req.body.reply !== undefined
            ) {

                updateData.reply =
                    reply;

            }


            const result =
                await tickets.updateOne(

                    {
                        _id: id
                    },

                    {
                        $set:
                            updateData
                    }

                );


            if (!result.matchedCount) {

                return res.status(404).json({

                    success: false,

                    message:
                        "درخواست پیدا نشد."

                });

            }


            const ticketId =
                id.toString();


            // -----------------------------------------
            // STATUS LOG
            // -----------------------------------------

            if (
                oldTicket.status !==
                status
            ) {

                await createLog({

                    action:
                        "STATUS_CHANGED",

                    ticketId,

                    actorType:
                        "command",

                    actorUsername:
                        req.commandUser.username,

                    actorName:
                        req.commandUser.name,

                    actorRank:
                        req.commandUser.rank,

                    actorRole:
                        req.commandUser.role,

                    message:
                        `وضعیت از ${oldTicket.status} به ${status} تغییر کرد.`,

                    metadata: {

                        oldStatus:
                            oldTicket.status,

                        newStatus:
                            status

                    }

                });

            }


            // -----------------------------------------
            // REPLY LOG
            // -----------------------------------------

            if (
                req.body.reply !== undefined &&
                reply
            ) {

                await createLog({

                    action:
                        "COMMAND_REPLY",

                    ticketId,

                    actorType:
                        "command",

                    actorUsername:
                        req.commandUser.username,

                    actorName:
                        req.commandUser.name,

                    actorRank:
                        req.commandUser.rank,

                    actorRole:
                        req.commandUser.role,

                    message:
                        reply

                });

            }


            res.json({

                success: true

            });

        } catch (error) {

            console.error(
                "PUT /tickets ERROR:",
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


// =================================================
// GET CHAT MESSAGES
// PUBLIC
// =================================================

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
                        "کد پیگیری نامعتبر است."

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
                        "درخواست پیدا نشد."

                });

            }


            res.json(
                ticket.messages || []
            );

        } catch (error) {

            console.error(
                "GET MESSAGES ERROR:",
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


// =================================================
// SEND APPLICANT MESSAGE
// PUBLIC
// =================================================

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
                        "کد پیگیری نامعتبر است."

                });

            }


            const message =
                text(req.body.message);


            if (!message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "پیام نمی‌تواند خالی باشد."

                });

            }


            if (
                message.length > 2000
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "پیام بیش از حد طولانی است."

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


            // -----------------------------------------
            // مهم:
            // sender همیشه applicant است.
            // کاربر نمی‌تواند خودش را command معرفی کند.
            // -----------------------------------------

            const chatMessage = {

                sender:
                    "applicant",

                message,

                createdAt:
                    new Date()

            };


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


            if (!result.matchedCount) {

                return res.status(404).json({

                    success: false,

                    message:
                        "درخواست پیدا نشد."

                });

            }


            await createLog({

                action:
                    "APPLICANT_MESSAGE",

                ticketId:
                    id.toString(),

                actorType:
                    "applicant",

                actorName:
                    ticket.icName ||
                    ticket.ocName,

                message,

                metadata: {

                    discord:
                        ticket.discord ||
                        ticket.discordId

                }

            });


            res.json({

                success: true,

                message:
                    chatMessage

            });

        } catch (error) {

            console.error(
                "POST APPLICANT MESSAGE ERROR:",
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


// =================================================
// SEND COMMAND MESSAGE
// COMMAND ONLY
// =================================================

app.post(
    "/tickets/:id/messages/command",
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
                        "کد پیگیری نامعتبر است."

                });

            }


            const message =
                text(req.body.message);


            if (!message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "پیام نمی‌تواند خالی باشد."

                });

            }


            if (
                message.length > 2000
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "پیام بیش از حد طولانی است."

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


            const chatMessage = {

                sender:
                    "command",

                message,

                commandUsername:
                    req.commandUser.username,

                commandName:
                    req.commandUser.name,

                commandRank:
                    req.commandUser.rank,

                commandRole:
                    req.commandUser.role,

                createdAt:
                    new Date()

            };


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

                            reply:
                                message,

                            updatedAt:
                                new Date()

                        }

                    }

                );


            if (!result.matchedCount) {

                return res.status(404).json({

                    success: false,

                    message:
                        "درخواست پیدا نشد."

                });

            }


            // -----------------------------------------
            // ثبت خودکار لاگ فرمانده
            // -----------------------------------------

            await createLog({

                action:
                    "COMMAND_MESSAGE",

                ticketId:
                    id.toString(),

                actorType:
                    "command",

                actorUsername:
                    req.commandUser.username,

                actorName:
                    req.commandUser.name,

                actorRank:
                    req.commandUser.rank,

                actorRole:
                    req.commandUser.role,

                message

            });


            res.json({

                success: true,

                message:
                    chatMessage

            });

        } catch (error) {

            console.error(
                "POST COMMAND MESSAGE ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "خطا در ارسال پیام فرماندهی"

            });

        }

    }
);


// =================================================
// DELETE TICKET
// SUPER ADMIN ONLY
// =================================================

app.delete(
    "/tickets/:id",
    requireCommand,
    requireSuperAdmin,
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
                        "شناسه تیکت نامعتبر است."

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
                        "تیکت پیدا نشد."

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
                        "تیکت حذف نشد."

                });

            }


            // -----------------------------------------
            // لاگ حذف
            // -----------------------------------------

            await createLog({

                action:
                    "TICKET_DELETED",

                ticketId:
                    id.toString(),

                actorType:
                    "command",

                actorUsername:
                    req.commandUser.username,

                actorName:
                    req.commandUser.name,

                actorRank:
                    req.commandUser.rank,

                actorRole:
                    req.commandUser.role,

                message:
                    "تیکت توسط Super Admin حذف شد.",

                metadata: {

                    applicant:
                        ticket.icName ||
                        ticket.ocName,

                    requestType:
                        ticket.requestType,

                    status:
                        ticket.status

                }

            });


            res.json({

                success: true

            });

        } catch (error) {

            console.error(
                "DELETE TICKET ERROR:",
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


// =================================================
// GET LOGS
// SUPER ADMIN ONLY
// =================================================

app.get(
    "/admin/logs",
    requireCommand,
    requireSuperAdmin,
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
                "GET LOGS ERROR:",
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


// =================================================
// GET LOGS FOR ONE TICKET
// SUPER ADMIN ONLY
// =================================================

app.get(
    "/admin/logs/ticket/:id",
    requireCommand,
    requireSuperAdmin,
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
                        "شناسه تیکت نامعتبر است."

                });

            }


            const data =
                await logs
                    .find({

                        ticketId:
                            id.toString()

                    })
                    .sort({

                        createdAt: 1

                    })
                    .toArray();


            res.json({

                success: true,

                logs: data

            });

        } catch (error) {

            console.error(
                "GET TICKET LOGS ERROR:",
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


// =================================================
// DATABASE INDEXES
// =================================================

async function createIndexes() {

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


        console.log(
            "MongoDB indexes created ✅"
        );

    } catch (error) {

        console.error(
            "Index Error:",
            error
        );

    }

}


// =================================================
// START SERVER
// =================================================

async function startServer() {

    try {

        await client.connect();


        console.log(
            "MongoDB Connected ✅"
        );


        database =
            client.db("LSPD");


        tickets =
            database.collection(
                "tickets"
            );


        logs =
            database.collection(
                "logs"
            );


        await createIndexes();


        app.listen(
            PORT,
            () => {

                console.log(
                    `🚔 Vanguard LSPD Server running on port ${PORT}`
                );

                console.log(
                    "Command Account: LSPD"
                );

                console.log(
                    "Super Admin Account: SEDJAVAD"
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


// =================================================
// START
// =================================================

startServer();
