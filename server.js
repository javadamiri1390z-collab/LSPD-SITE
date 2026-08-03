// ============================================================
// VANGUARD LSPD - SERVER.JS
// MongoDB Ticket + Authentication + Command Logs
// ============================================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

// ============================================================
// CONFIG
// ============================================================

const PORT = process.env.PORT || 3000;

const MONGO_URI = process.env.MONGODB_URI;

// ------------------------------------------------------------
// Command Accounts
// ------------------------------------------------------------
// بهتر است این موارد را در Environment Variables قرار دهید.
// مقادیر پیش‌فرض برای هماهنگی با سیستم قبلی گذاشته شده‌اند.
// ------------------------------------------------------------

const COMMAND_USERNAME =
    process.env.COMMAND_USERNAME || "LSPD";

const COMMAND_PASSWORD =
    process.env.COMMAND_PASSWORD || "LSPD00078";

const COMMAND_NAME =
    process.env.COMMAND_NAME || "Vanguard Command";

const COMMAND_RANK =
    process.env.COMMAND_RANK || "Commander";


// ============================================================
// Owner Account
// ============================================================

const OWNER_USERNAME =
    process.env.OWNER_USERNAME || "SEDJAVAD";

const OWNER_PASSWORD =
    process.env.OWNER_PASSWORD || "SEDJAVAD00078";

const OWNER_NAME =
    process.env.OWNER_NAME || "SEDJAVAD";

const OWNER_RANK =
    process.env.OWNER_RANK || "LSPD High Command";


// ============================================================
// Middleware
// ============================================================

app.use(cors());

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(express.static(__dirname));


// ============================================================
// MongoDB
// ============================================================

if (!MONGO_URI) {

    console.error(
        "❌ MONGODB_URI در Environment Variables تنظیم نشده است."
    );

    process.exit(1);
}

const client =
    new MongoClient(MONGO_URI);

let database;
let tickets;
let logs;


// ============================================================
// Helpers
// ============================================================

function text(value) {

    return String(
        value ?? ""
    ).trim();

}


function safeObjectId(id) {

    if (!ObjectId.isValid(id)) {

        return null;

    }

    return new ObjectId(id);

}


function now() {

    return new Date();

}


// ============================================================
// Token System
// ============================================================
//
// بدون نیاز به JWT package.
// Token با HMAC ساخته می‌شود.
//
// توجه:
// برای امنیت واقعی SECRET_TOKEN را در Render Environment
// Variables قرار دهید.
// ============================================================

const TOKEN_SECRET =
    process.env.TOKEN_SECRET ||
    crypto.randomBytes(32).toString("hex");


function createToken(user) {

    const payload = {

        username: user.username,

        name: user.name,

        rank: user.rank,

        role: user.role,

        issuedAt: Date.now()

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


    return encoded + "." + signature;

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


        const expected =
            crypto
                .createHmac(
                    "sha256",
                    TOKEN_SECRET
                )
                .update(encoded)
                .digest("base64url");


        if (
            signature.length !==
            expected.length
        ) {

            return null;

        }


        if (
            !crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expected)
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


        // Token حداکثر 24 ساعت معتبر باشد.

        if (
            !payload.issuedAt ||
            Date.now() - payload.issuedAt >
            24 * 60 * 60 * 1000
        ) {

            return null;

        }


        return payload;

    } catch (error) {

        return null;

    }

}


// ============================================================
// Authentication Middleware
// ============================================================

function getTokenFromRequest(req) {

    const authorization =
        text(req.headers.authorization);


    if (
        authorization &&
        authorization.startsWith("Bearer ")
    ) {

        return authorization.substring(7).trim();

    }


    const customToken =
        text(req.headers["x-admin-token"]);


    if (customToken) {

        return customToken;

    }


    return "";

}


function requireAuth(req, res, next) {

    const token =
        getTokenFromRequest(req);


    const user =
        verifyToken(token);


    if (!user) {

        return res.status(401).json({

            success: false,

            message:
                "دسترسی غیرمجاز. لطفاً وارد شوید."

        });

    }


    req.user = user;

    next();

}


function requireCommand(req, res, next) {

    const token =
        getTokenFromRequest(req);


    const user =
        verifyToken(token);


    if (!user) {

        return res.status(401).json({

            success: false,

            message:
                "ابتدا وارد پنل فرماندهی شوید."

        });

    }


    if (
        user.role !== "command" &&
        user.role !== "owner"
    ) {

        return res.status(403).json({

            success: false,

            message:
                "شما دسترسی فرماندهی ندارید."

        });

    }


    req.user = user;

    next();

}


function requireOwner(req, res, next) {

    const token =
        getTokenFromRequest(req);


    const user =
        verifyToken(token);


    if (!user) {

        return res.status(401).json({

            success: false,

            message:
                "ابتدا وارد شوید."

        });

    }


    if (user.role !== "owner") {

        return res.status(403).json({

            success: false,

            message:
                "این بخش فقط برای مالک سیستم قابل دسترسی است."

        });

    }


    req.user = user;

    next();

}


// ============================================================
// LOG SYSTEM
// ============================================================

async function createLog({

    action,

    ticketId = null,

    actor = null,

    details = {}

}) {

    try {

        if (!logs) {

            console.warn(
                "⚠️ Logs collection هنوز آماده نیست."
            );

            return;

        }


        const log = {

            action: text(action),

            ticketId:
                ticketId
                ? String(ticketId)
                : null,

            actor: {

                type:
                    actor?.role ||
                    "system",

                username:
                    actor?.username ||
                    "System",

                name:
                    actor?.name ||
                    "System",

                rank:
                    actor?.rank ||
                    "System"

            },

            details,

            createdAt: now()

        };


        await logs.insertOne(log);


        console.log(
            "📝 LOG:",
            log.action,
            "|",
            log.actor.name,
            "|",
            log.actor.rank
        );


    } catch (error) {

        console.error(
            "❌ Create Log Error:",
            error
        );

    }

}


// ============================================================
// HOME
// ============================================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "index.html"
        )
    );

});


// ============================================================
// AUTH LOGIN
// ============================================================

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


        let user = null;


        // ----------------------------------------------------
        // OWNER
        // ----------------------------------------------------

        if (
            username === OWNER_USERNAME &&
            password === OWNER_PASSWORD
        ) {

            user = {

                username:
                    OWNER_USERNAME,

                name:
                    OWNER_NAME,

                rank:
                    OWNER_RANK,

                role:
                    "owner"

            };

        }


        // ----------------------------------------------------
        // COMMAND
        // ----------------------------------------------------

        else if (
            username === COMMAND_USERNAME &&
            password === COMMAND_PASSWORD
        ) {

            user = {

                username:
                    COMMAND_USERNAME,

                name:
                    COMMAND_NAME,

                rank:
                    COMMAND_RANK,

                role:
                    "command"

            };

        }


        // ----------------------------------------------------
        // WRONG LOGIN
        // ----------------------------------------------------

        else {

            await createLog({

                action:
                    "LOGIN_FAILED",

                actor: {

                    role:
                        "unknown",

                    username,

                    name:
                        username,

                    rank:
                        "Unknown"

                },

                details: {

                    ip:
                        req.ip

                }

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

            actor:
                user,

            details: {

                ip:
                    req.ip

            }

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
                    user.role,

                isOwner:
                    user.role === "owner"

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


// ============================================================
// AUTH ME
// ============================================================

app.get(
    "/auth/me",
    requireAuth,
    async (req, res) => {

        res.json({

            success: true,

            user: {

                username:
                    req.user.username,

                name:
                    req.user.name,

                rank:
                    req.user.rank,

                role:
                    req.user.role,

                isOwner:
                    req.user.role === "owner"

            }

        });

    }
);


// ============================================================
// GET ALL TICKETS
// ============================================================

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


// ============================================================
// GET SINGLE TICKET
// ============================================================

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


// ============================================================
// CREATE NEW TICKET
// ============================================================

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


            // ------------------------------------------------
            // SCORE
            // ------------------------------------------------

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


            // ------------------------------------------------
            // TICKET
            // ------------------------------------------------

            const ticket = {

                requestType,


                // مشترک

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


                // Membership

                experience:
                    text(body.experience),

                reason:
                    text(body.reason),


                // Division

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


                // Resignation

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


                // Rankup

                requestRank:
                    text(body.requestRank),

                currentRankTimeplay:
                    text(
                        body.currentRankTimeplay
                    ),

                note:
                    text(body.note),


                // Exam

                score,

                passed,

                passingScore:
                    12,


                // Status

                status:
                    "Pending",


                // Reply

                reply:
                    "در انتظار پاسخ فرماندهی",


                // Chat

                messages: [],


                // Dates

                createdAt:
                    now(),

                updatedAt:
                    now()

            };


            const result =
                await tickets.insertOne(
                    ticket
                );


            const ticketId =
                result.insertedId.toString();


            console.log(
                "🎫 New Ticket:",
                ticketId
            );


            // ------------------------------------------------
            // AUTO LOG
            // ------------------------------------------------

            await createLog({

                action:
                    "TICKET_CREATED",

                ticketId,

                actor: {

                    role:
                        "applicant",

                    username:
                        ticket.discord ||
                        "Applicant",

                    name:
                        ticket.icName ||
                        ticket.ocName ||
                        "Applicant",

                    rank:
                        "Applicant"

                },

                details: {

                    requestType,

                    score,

                    passed

                }

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


// ============================================================
// UPDATE TICKET
// ============================================================

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


            const oldStatus =
                ticket.status;


            const oldReply =
                ticket.reply;


            const status =
                text(req.body.status) ||
                "Pending";


            const reply =
                text(req.body.reply);


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
                                now()

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


            // ------------------------------------------------
            // LOG STATUS CHANGE
            // ------------------------------------------------

            if (oldStatus !== status) {

                await createLog({

                    action:
                        "TICKET_STATUS_CHANGED",

                    ticketId:
                        id.toString(),

                    actor:
                        req.user,

                    details: {

                        oldStatus,

                        newStatus:
                            status

                    }

                });

            }


            // ------------------------------------------------
            // LOG REPLY
            // ------------------------------------------------

            if (oldReply !== reply) {

                await createLog({

                    action:
                        "TICKET_REPLY_UPDATED",

                    ticketId:
                        id.toString(),

                    actor:
                        req.user,

                    details: {

                        reply

                    }

                });

            }


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


// ============================================================
// GET CHAT MESSAGES
// ============================================================

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

                            messages:
                                1

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


// ============================================================
// SEND CHAT MESSAGE
// ============================================================
//
// applicant:
// بدون لاگین می‌تواند پیام خودش را بفرستد.
//
// command:
// باید Authorization داشته باشد.
//
// sender از body قابل اعتماد نیست.
// ============================================================

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


            const message =
                text(req.body.message);


            if (!message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "پیام نمی‌تواند خالی باشد"

                });

            }


            if (message.length > 2000) {

                return res.status(400).json({

                    success: false,

                    message:
                        "پیام بیش از حد طولانی است"

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


            // ------------------------------------------------
            // تشخیص فرمانده از Token
            // ------------------------------------------------

            const token =
                getTokenFromRequest(req);


            const authenticatedUser =
                verifyToken(token);


            let sender =
                "applicant";


            let actor = {

                role:
                    "applicant",

                username:
                    ticket.discord ||
                    "Applicant",

                name:
                    ticket.icName ||
                    ticket.ocName ||
                    "Applicant",

                rank:
                    "Applicant"

            };


            if (authenticatedUser) {

                if (
                    authenticatedUser.role !==
                        "command" &&
                    authenticatedUser.role !==
                        "owner"
                ) {

                    return res.status(403).json({

                        success: false,

                        message:
                            "دسترسی غیرمجاز"

                    });

                }


                sender =
                    "command";


                actor =
                    authenticatedUser;

            }


            // ------------------------------------------------
            // Message Object
            // ------------------------------------------------

            const chatMessage = {

                sender,

                message,

                senderUsername:
                    actor.username,

                senderName:
                    actor.name,

                senderRank:
                    actor.rank,

                senderRole:
                    actor.role,

                createdAt:
                    now()

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
                                now()

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


            // ------------------------------------------------
            // AUTO LOG
            // ------------------------------------------------

            await createLog({

                action:
                    sender === "command"
                        ? "COMMAND_MESSAGE_SENT"
                        : "APPLICANT_MESSAGE_SENT",

                ticketId:
                    id.toString(),

                actor,

                details: {

                    message

                }

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


// ============================================================
// DELETE TICKET
// ============================================================
//
// فقط OWNER
// ============================================================

app.delete(
    "/tickets/:id",
    requireOwner,
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


            // ابتدا اطلاعات تیکت را می‌گیریم
            // تا بعد از حذف هم لاگ کامل داشته باشیم.

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
                result.deletedCount <= 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "تیکت حذف نشد"

                });

            }


            // ------------------------------------------------
            // AUTO LOG DELETE
            // ------------------------------------------------

            await createLog({

                action:
                    "TICKET_DELETED",

                ticketId:
                    id.toString(),

                actor:
                    req.user,

                details: {

                    requestType:
                        ticket.requestType,

                    icName:
                        ticket.icName,

                    ocName:
                        ticket.ocName,

                    status:
                        ticket.status

                }

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


// ============================================================
// GET LOGS
// ============================================================
//
// فقط OWNER
// ============================================================

app.get(
    "/logs",
    requireOwner,
    async (req, res) => {

        try {

            const limit =
                Math.min(

                    Math.max(

                        Number(
                            req.query.limit
                        ) || 100,

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
                "GET /logs Error:",
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


// ============================================================
// GET TICKET LOGS
// ============================================================
//
// فقط OWNER
// ============================================================

app.get(
    "/logs/ticket/:id",
    requireOwner,
    async (req, res) => {

        try {

            const ticketId =
                text(req.params.id);


            if (!ticketId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "شناسه تیکت نامعتبر است"

                });

            }


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


// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/health",
    async (req, res) => {

        res.json({

            success: true,

            server:
                "Vanguard LSPD",

            mongodb:
                !!database,

            time:
                now()

        });

    }
);


// ============================================================
// START SERVER
// ============================================================

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


        // ----------------------------------------------------
        // Indexes
        // ----------------------------------------------------

        try {

            await logs.createIndex({
                createdAt: -1
            });


            await logs.createIndex({
                ticketId: 1
            });


            await tickets.createIndex({
                createdAt: -1
            });


            console.log(
                "MongoDB Indexes Ready ✅"
            );

        } catch (indexError) {

            console.warn(
                "⚠️ Index creation warning:",
                indexError.message
            );

        }


        // ----------------------------------------------------
        // Server
        // ----------------------------------------------------

        app.listen(
            PORT,
            () => {

                console.log(
                    "=========================================="
                );

                console.log(
                    "🚔 Vanguard LSPD Server"
                );

                console.log(
                    `🌐 Port: ${PORT}`
                );

                console.log(
                    "🍃 MongoDB: Connected"
                );

                console.log(
                    "📝 Logs: Enabled"
                );

                console.log(
                    "🔐 Auth: Enabled"
                );

                console.log(
                    "👮 Command Access: Enabled"
                );

                console.log(
                    "👑 Owner Access: Enabled"
                );

                console.log(
                    "=========================================="
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


// ============================================================
// Graceful Shutdown
// ============================================================

process.on(
    "SIGINT",
    async () => {

        console.log(
            "🛑 Closing server..."
        );


        try {

            await client.close();

        } catch (error) {

            console.error(
                error
            );

        }


        process.exit(0);

    }
);


process.on(
    "SIGTERM",
    async () => {

        console.log(
            "🛑 Closing server..."
        );


        try {

            await client.close();

        } catch (error) {

            console.error(
                error
            );

        }


        process.exit(0);

    }
);


// ============================================================
// RUN
// ============================================================

startServer();
