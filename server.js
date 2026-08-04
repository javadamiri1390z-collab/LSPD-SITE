// ============================================================
// VANGUARD LSPD - SERVER.JS
// MongoDB + Authentication + Command + Owner + Tickets + Chat
// Compatible with:
//   command-login.html
//   command.html
// Express 5 / Node.js 24
// ============================================================

"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

// ============================================================
// CONFIG
// ============================================================

const PORT = Number(process.env.PORT) || 3000;

const MONGO_URI =
    String(process.env.MONGODB_URI || "").trim();

if (!MONGO_URI) {
    console.error("❌ MONGODB_URI تنظیم نشده است.");
    process.exit(1);
}

// ============================================================
// ACCOUNTS
// ============================================================

const COMMAND_USERNAME = "LSPD";
const COMMAND_PASSWORD = "LSPD00078";

const COMMAND_NAME =
    process.env.COMMAND_NAME ||
    "Vanguard Command";

const COMMAND_RANK =
    process.env.COMMAND_RANK ||
    "Commander";


const OWNER_USERNAME = "SEDJAVAD";
const OWNER_PASSWORD = "SEDJAVAD00078";

const OWNER_NAME =
    process.env.OWNER_NAME ||
    "SEDJAVAD";

const OWNER_RANK =
    process.env.OWNER_RANK ||
    "LSPD High Command";

// ============================================================
// TOKEN SECRET
// ============================================================
//
// مهم:
// اگر TOKEN_SECRET در Render تعریف شده باشد از آن استفاده می‌شود.
//
// اگر تعریف نشده باشد، از MONGODB_URI یک Secret پایدار ساخته می‌شود.
// بنابراین با Restart شدن Render توکن‌های قبلی بی‌دلیل باطل نمی‌شوند.
//
// توصیه:
// در Render > Environment Variables
// TOKEN_SECRET را به یک مقدار طولانی و تصادفی تغییر بده.
// ============================================================

const TOKEN_SECRET =
    String(
        process.env.TOKEN_SECRET ||
        crypto
            .createHash("sha256")
            .update(
                MONGO_URI +
                "|VANGUARD-LSPD-STABLE-TOKEN-SECRET"
            )
            .digest("hex")
    );

// ============================================================
// TOKEN EXPIRATION
// ============================================================

const TOKEN_MAX_AGE =
    7 * 24 * 60 * 60 * 1000;

// ============================================================
// MIDDLEWARE
// ============================================================

app.set("trust proxy", 1);

app.disable("x-powered-by");

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------

app.use(
    cors({
        origin: true,
        credentials: false,
        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Accept",
            "X-Admin-Token"
        ]
    })
);

// ------------------------------------------------------------
// JSON
// ------------------------------------------------------------

app.use(
    express.json({
        limit: "2mb"
    })
);

// ------------------------------------------------------------
// URL ENCODED
// ------------------------------------------------------------

app.use(
    express.urlencoded({
        extended: true,
        limit: "2mb"
    })
);

// ============================================================
// STATIC FILES
// ============================================================

app.use(
    express.static(__dirname)
);

// ============================================================
// MONGODB
// ============================================================

const client =
    new MongoClient(MONGO_URI);

let database = null;
let tickets = null;
let logs = null;

// ============================================================
// HELPERS
// ============================================================

function text(value) {
    return String(
        value ?? ""
    ).trim();
}

function normalizeUsername(value) {
    return text(value).toLowerCase();
}

function now() {
    return new Date();
}

function safeObjectId(id) {

    const value =
        text(id);

    if (
        !value ||
        !ObjectId.isValid(value)
    ) {
        return null;
    }

    return new ObjectId(value);
}

// ============================================================
// PUBLIC USER
// ============================================================

function publicUser(user) {

    return {
        username:
            user?.username || "",

        name:
            user?.name || "",

        rank:
            user?.rank || "",

        role:
            user?.role || "command",

        isOwner:
            user?.role === "owner"
    };
}

// ============================================================
// TOKEN SYSTEM
// ============================================================

function createToken(user) {

    const payload = {

        username:
            user.username,

        name:
            user.name,

        rank:
            user.rank,

        role:
            user.role,

        isOwner:
            user.role === "owner",

        issuedAt:
            Date.now()

    };

    const encoded =
        Buffer
            .from(
                JSON.stringify(payload),
                "utf8"
            )
            .toString("base64url");


    const signature =
        crypto
            .createHmac(
                "sha256",
                TOKEN_SECRET
            )
            .update(encoded)
            .digest("base64url");


    return (
        encoded +
        "." +
        signature
    );
}

// ============================================================
// VERIFY TOKEN
// ============================================================

function verifyToken(token) {

    try {

        const cleanToken =
            text(token);

        if (!cleanToken) {
            return null;
        }

        const parts =
            cleanToken.split(".");

        if (
            parts.length !== 2
        ) {
            return null;
        }

        const encoded =
            parts[0];

        const signature =
            parts[1];

        if (
            !encoded ||
            !signature
        ) {
            return null;
        }


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


        const signaturesMatch =
            crypto.timingSafeEqual(

                Buffer.from(
                    signature,
                    "utf8"
                ),

                Buffer.from(
                    expected,
                    "utf8"
                )

            );


        if (!signaturesMatch) {
            return null;
        }


        const payload =
            JSON.parse(

                Buffer
                    .from(
                        encoded,
                        "base64url"
                    )
                    .toString("utf8")

            );


        if (
            !payload ||
            !payload.username ||
            !payload.role ||
            !payload.issuedAt
        ) {
            return null;
        }


        const age =
            Date.now() -
            Number(payload.issuedAt);


        if (
            !Number.isFinite(age) ||
            age < 0 ||
            age > TOKEN_MAX_AGE
        ) {
            return null;
        }


        if (
            ![
                "command",
                "owner"
            ].includes(
                payload.role
            )
        ) {
            return null;
        }


        return {

            username:
                payload.username,

            name:
                payload.name || "",

            rank:
                payload.rank || "",

            role:
                payload.role,

            isOwner:
                payload.role === "owner",

            issuedAt:
                payload.issuedAt

        };

    } catch (error) {

        console.error(
            "❌ Token Verify Error:",
            error.message
        );

        return null;
    }
}

// ============================================================
// GET TOKEN FROM REQUEST
// ============================================================

function getTokenFromRequest(req) {

    const authorization =
        text(
            req.headers.authorization
        );


    if (
        authorization &&
        authorization
            .toLowerCase()
            .startsWith("bearer ")
    ) {

        return authorization
            .substring(7)
            .trim();

    }


    const customToken =
        text(
            req.headers["x-admin-token"]
        );


    if (customToken) {
        return customToken;
    }


    return "";
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function requireAuth(req, res, next) {

    const token =
        getTokenFromRequest(req);

    const user =
        verifyToken(token);


    if (!user) {

        return res.status(401).json({

            success: false,

            message:
                "توکن ورود نامعتبر یا منقضی شده است. دوباره وارد شوید."

        });

    }


    req.user =
        user;


    next();
}

// ============================================================
// COMMAND AUTH
// ============================================================

function requireCommand(req, res, next) {

    const token =
        getTokenFromRequest(req);

    const user =
        verifyToken(token);


    if (!user) {

        console.warn(
            "⚠️ COMMAND 401:",
            req.method,
            req.originalUrl
        );

        return res.status(401).json({

            success: false,

            message:
                "احراز هویت فرماندهی نامعتبر است. لطفاً دوباره وارد شوید."

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


    req.user =
        user;


    next();
}

// ============================================================
// OWNER AUTH
// ============================================================

function requireOwner(req, res, next) {

    const token =
        getTokenFromRequest(req);

    const user =
        verifyToken(token);


    if (!user) {

        return res.status(401).json({

            success: false,

            message:
                "جلسه ورود معتبر نیست. دوباره وارد شوید."

        });

    }


    if (
        user.role !== "owner"
    ) {

        return res.status(403).json({

            success: false,

            message:
                "این بخش فقط برای مالک سیستم است."

        });

    }


    req.user =
        user;


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
                "⚠️ Logs collection آماده نیست."
            );

            return;
        }


        const log = {

            action:
                text(action),

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

            details:
                details || {},

            createdAt:
                now()

        };


        await logs.insertOne(
            log
        );


        console.log(
            "📝 LOG:",
            log.action,
            "|",
            log.actor.username
        );


    } catch (error) {

        console.error(
            "❌ Create Log Error:",
            error
        );

    }

}

// ============================================================
// HEALTH
// ============================================================

app.get(
    "/health",
    async (req, res) => {

        return res.json({

            success:
                true,

            server:
                "Vanguard LSPD",

            mongodb:
                !!database,

            auth:
                true,

            command:
                true,

            owner:
                true,

            logs:
                !!logs,

            time:
                now()

        });

    }
);

// ============================================================
// HTML ROUTES
// ============================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );

    }
);


app.get(
    "/index.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );

    }
);


app.get(
    "/command",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "command.html"
            )
        );

    }
);


app.get(
    "/command.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "command.html"
            )
        );

    }
);


app.get(
    "/command-login",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "command-login.html"
            )
        );

    }
);


app.get(
    "/command-login.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "command-login.html"
            )
        );

    }
);

// ============================================================
// LOGIN
// ============================================================

app.post(
    "/auth/login",
    async (req, res) => {

        try {

            const usernameRaw =
                text(
                    req.body?.username
                );

            const password =
                text(
                    req.body?.password
                );


            const username =
                normalizeUsername(
                    usernameRaw
                );


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


            let user =
                null;


            // ------------------------------------------------
            // OWNER
            // ------------------------------------------------

            if (

                username ===
                normalizeUsername(
                    OWNER_USERNAME
                ) &&

                password ===
                OWNER_PASSWORD

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


            // ------------------------------------------------
            // COMMAND
            // ------------------------------------------------

            else if (

                username ===
                normalizeUsername(
                    COMMAND_USERNAME
                ) &&

                password ===
                COMMAND_PASSWORD

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


            // ------------------------------------------------
            // WRONG LOGIN
            // ------------------------------------------------

            else {

                await createLog({

                    action:
                        "LOGIN_FAILED",

                    actor: {

                        role:
                            "unknown",

                        username:
                            usernameRaw,

                        name:
                            usernameRaw,

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


            // ------------------------------------------------
            // CREATE TOKEN
            // ------------------------------------------------

            const token =
                createToken(user);


            // ------------------------------------------------
            // LOG
            // ------------------------------------------------

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


            console.log(
                "✅ LOGIN:",
                user.username,
                "|",
                user.role
            );


            // ------------------------------------------------
            // RESPONSE
            // ------------------------------------------------

            return res.json({

                success:
                    true,

                token,

                user:
                    publicUser(user)

            });


        } catch (error) {

            console.error(
                "❌ LOGIN ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطای داخلی سرور در ورود."

            });

        }

    }
);

// ============================================================
// AUTH ME
// ============================================================

app.get(
    "/auth/me",
    requireAuth,
    async (req, res) => {

        return res.json({

            success:
                true,

            user:
                publicUser(
                    req.user
                )

        });

    }
);

// ============================================================
// CREATE TICKET
// PUBLIC
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

            let score =
                null;


            if (

                body.score !==
                    undefined &&

                body.score !==
                    null &&

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


            // ------------------------------------------------
            // TICKET
            // ------------------------------------------------

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

                experience:
                    text(
                        body.experience
                    ),

                reason:
                    text(
                        body.reason
                    ),

                reasonForRequest:
                    text(
                        body.reasonForRequest
                    ),

                currentDivision:
                    text(
                        body.currentDivision
                    ),

                requestedDivision:
                    text(
                        body.requestedDivision
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

                score,

                passed,

                passingScore:
                    12,

                status:
                    "Pending",

                reply:
                    "در انتظار پاسخ فرماندهی",

                messages:
                    [],

                createdAt:
                    now(),

                updatedAt:
                    now()

            };


            // ------------------------------------------------
            // INSERT
            // ------------------------------------------------

            const result =
                await tickets.insertOne(
                    ticket
                );


            const ticketId =
                result.insertedId.toString();


            // ------------------------------------------------
            // LOG
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

                    passed,

                    icName:
                        ticket.icName,

                    ocName:
                        ticket.ocName,

                    discord:
                        ticket.discord

                }

            });


            return res.json({

                success:
                    true,

                id:
                    ticketId,

                score,

                passed

            });


        } catch (error) {

            console.error(
                "❌ POST /tickets Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطا در ثبت درخواست."

            });

        }

    }
);

// ============================================================
// GET ALL TICKETS
// COMMAND + OWNER
// ============================================================

app.get(
    "/tickets",
    requireCommand,
    async (req, res) => {

        try {

            if (!tickets) {

                return res.status(503).json({

                    success: false,

                    message:
                        "Database هنوز آماده نیست."

                });

            }


            const data =
                await tickets
                    .find({})
                    .sort({
                        createdAt: -1
                    })
                    .toArray();


            return res.json(
                data
            );


        } catch (error) {

            console.error(
                "❌ GET /tickets Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطا در دریافت درخواست‌ها."

            });

        }

    }
);

// ============================================================
// GET SINGLE TICKET
// PUBLIC
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

                    _id:
                        id

                });


            if (!ticket) {

                return res.status(404).json({

                    success: false,

                    message:
                        "درخواست پیدا نشد."

                });

            }


            return res.json(
                ticket
            );


        } catch (error) {

            console.error(
                "❌ GET SINGLE TICKET Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطا در دریافت درخواست."

            });

        }

    }
);

// ============================================================
// UPDATE TICKET
// COMMAND + OWNER
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
                        "شناسه تیکت نامعتبر است."

                });

            }


            const ticket =
                await tickets.findOne({

                    _id:
                        id

                });


            if (!ticket) {

                return res.status(404).json({

                    success: false,

                    message:
                        "درخواست پیدا نشد."

                });

            }


            const oldStatus =
                ticket.status ||
                "Pending";


            const oldReply =
                ticket.reply ||
                "";


            const status =
                text(
                    req.body?.status
                ) ||
                "Pending";


            const reply =
                text(
                    req.body?.reply
                );


            if (

                ![
                    "Pending",
                    "Accepted",
                    "Rejected"
                ].includes(status)

            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "وضعیت نامعتبر است."

                });

            }


            const result =
                await tickets.updateOne(

                    {
                        _id:
                            id
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


            if (
                !result.matchedCount
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "درخواست پیدا نشد."

                });

            }


            // ------------------------------------------------
            // LOG STATUS
            // ------------------------------------------------

            if (
                oldStatus !== status
            ) {

                await createLog({

                    action:
                        "TICKET_STATUS_CHANGED",

                    ticketId:
                        id.toString(),

                    actor:
                        req.user,

                    details: {

                        ticketApplicant:
                            ticket.icName ||
                            ticket.name ||
                            ticket.ocName ||
                            "Unknown",

                        oldStatus,

                        newStatus:
                            status

                    }

                });

            }


            // ------------------------------------------------
            // LOG REPLY
            // ------------------------------------------------

            if (
                oldReply !== reply
            ) {

                await createLog({

                    action:
                        "TICKET_REPLY_UPDATED",

                    ticketId:
                        id.toString(),

                    actor:
                        req.user,

                    details: {

                        ticketApplicant:
                            ticket.icName ||
                            ticket.name ||
                            ticket.ocName ||
                            "Unknown",

                        reply

                    }

                });

            }


            return res.json({

                success:
                    true

            });


        } catch (error) {

            console.error(
                "❌ PUT /tickets Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطا در بروزرسانی تیکت."

            });

        }

    }
);

// ============================================================
// DELETE TICKET
// OWNER ONLY
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
                        "شناسه تیکت نامعتبر است."

                });

            }


            const ticket =
                await tickets.findOne({

                    _id:
                        id

                });


            if (!ticket) {

                return res.status(404).json({

                    success: false,

                    message:
                        "درخواست پیدا نشد."

                });

            }


            const result =
                await tickets.deleteOne({

                    _id:
                        id

                });


            if (
                !result.deletedCount
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "تیکت حذف نشد."

                });

            }


            await createLog({

                action:
                    "TICKET_DELETED",

                ticketId:
                    id.toString(),

                actor:
                    req.user,

                details: {

                    applicant:
                        ticket.icName ||
                        ticket.name ||
                        ticket.ocName ||
                        "Unknown",

                    requestType:
                        ticket.requestType ||
                        "Unknown",

                    discord:
                        ticket.discord ||
                        ticket.discordId ||
                        ""

                }

            });


            return res.json({

                success:
                    true,

                message:
                    "تیکت با موفقیت حذف شد."

            });


        } catch (error) {

            console.error(
                "❌ DELETE TICKET Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطا در حذف تیکت."

            });

        }

    }
);

// ============================================================
// GET CHAT MESSAGES
// PUBLIC READ
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
                        "کد پیگیری نامعتبر است."

                });

            }


            const ticket =
                await tickets.findOne(

                    {
                        _id:
                            id
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
                        "درخواست پیدا نشد."

                });

            }


            return res.json(

                Array.isArray(
                    ticket.messages
                )
                    ? ticket.messages
                    : []

            );


        } catch (error) {

            console.error(
                "❌ GET MESSAGES Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطا در دریافت چت."

            });

        }

    }
);

// ============================================================
// SEND CHAT MESSAGE
//
// مهم:
// اگر Authorization معتبر باشد، فرستنده command/owner است.
// بنابراین command.html حتی بدون sender هم می‌تواند پیام بفرستد.
//
// اگر Token وجود نداشته باشد، پیام applicant محسوب می‌شود.
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
                        "کد پیگیری نامعتبر است."

                });

            }


            const message =
                text(
                    req.body?.message
                );


            if (!message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "پیام خالی است."

                });

            }


            if (
                message.length > 3000
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "پیام بیش از حد طولانی است."

                });

            }


            // ------------------------------------------------
            // CHECK TOKEN
            // ------------------------------------------------

            const token =
                getTokenFromRequest(
                    req
                );


            const authenticatedUser =
                token
                    ? verifyToken(token)
                    : null;


            // ------------------------------------------------
            // DETERMINE SENDER
            // ------------------------------------------------

            let sender =
                "applicant";


            let commandUser =
                null;


            // اگر Token معتبر فرماندهی باشد
            if (
                authenticatedUser &&
                (
                    authenticatedUser.role ===
                        "command" ||

                    authenticatedUser.role ===
                        "owner"
                )
            ) {

                sender =
                    "command";

                commandUser =
                    authenticatedUser;

            }


            // ------------------------------------------------
            // IF USER EXPLICITLY SAYS COMMAND
            // BUT TOKEN INVALID
            // ------------------------------------------------

            const requestedSender =
                text(
                    req.body?.sender
                ).toLowerCase();


            if (
                requestedSender ===
                "command"
            ) {

                if (!commandUser) {

                    return res.status(401).json({

                        success: false,

                        message:
                            "برای ارسال پیام فرماندهی باید وارد شوید."

                    });

                }

            }


            // ------------------------------------------------
            // FIND TICKET
            // ------------------------------------------------

            const ticket =
                await tickets.findOne({

                    _id:
                        id

                });


            if (!ticket) {

                return res.status(404).json({

                    success: false,

                    message:
                        "درخواست پیدا نشد."

                });

            }


            // ------------------------------------------------
            // CHAT MESSAGE
            // ------------------------------------------------

            const chatMessage = {

                message,

                sender,

                senderName:

                    sender === "command"

                        ? (
                            commandUser.name ||
                            commandUser.username ||
                            "فرماندهی"
                        )

                        : (
                            ticket.icName ||
                            ticket.name ||
                            ticket.ocName ||
                            "متقاضی"
                        ),

                senderRank:

                    sender === "command"

                        ? (
                            commandUser.rank ||
                            ""
                        )

                        : "Applicant",

                senderUsername:

                    sender === "command"

                        ? (
                            commandUser.username ||
                            ""
                        )

                        : (
                            ticket.discord ||
                            "Applicant"
                        ),

                // ------------------------------------------------
                // Legacy fields
                // ------------------------------------------------

                commanderName:

                    sender === "command"

                        ? commandUser.name
                        : null,

                commanderRank:

                    sender === "command"

                        ? commandUser.rank
                        : null,

                commanderUsername:

                    sender === "command"

                        ? commandUser.username
                        : null,

                createdAt:
                    now()

            };


            // ------------------------------------------------
            // SAVE MESSAGE
            // ------------------------------------------------

            const updateResult =
                await tickets.updateOne(

                    {
                        _id:
                            id
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


            if (
                !updateResult.matchedCount
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "تیکت پیدا نشد."

                });

            }


            // ------------------------------------------------
            // LOG
            // ------------------------------------------------

            await createLog({

                action:

                    sender === "command"

                        ? "COMMAND_MESSAGE_SENT"

                        : "APPLICANT_MESSAGE_SENT",

                ticketId:
                    id.toString(),

                actor:

                    sender === "command"

                        ? commandUser

                        : {

                            role:
                                "applicant",

                            username:
                                ticket.discord ||
                                "Applicant",

                            name:
                                ticket.icName ||
                                ticket.name ||
                                ticket.ocName ||
                                "Applicant",

                            rank:
                                "Applicant"

                        },

                details: {

                    message

                }

            });


            return res.json({

                success:
                    true,

                message:
                    chatMessage

            });


        } catch (error) {

            console.error(
                "❌ POST MESSAGE Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطا در ارسال پیام."

            });

        }

    }
);

// ============================================================
// OWNER - GET LOGS
// ============================================================

app.get(
    "/logs",
    requireOwner,
    async (req, res) => {

        try {

            const requestedLimit =
                Number(
                    req.query.limit
                ) || 100;


            const limit =
                Math.min(

                    Math.max(
                        requestedLimit,
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


            return res.json({

                success:
                    true,

                logs:
                    data

            });


        } catch (error) {

            console.error(
                "❌ GET /logs Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطا در دریافت لاگ‌ها."

            });

        }

    }
);

// ============================================================
// OWNER - GET TICKET LOGS
// ============================================================

app.get(
    "/logs/ticket/:id",
    requireOwner,
    async (req, res) => {

        try {

            const ticketId =
                text(
                    req.params.id
                );


            if (!ticketId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "شناسه تیکت نامعتبر است."

                });

            }


            const data =
                await logs
                    .find({

                        ticketId

                    })
                    .sort({

                        createdAt:
                            1

                    })
                    .toArray();


            return res.json({

                success:
                    true,

                logs:
                    data

            });


        } catch (error) {

            console.error(
                "❌ GET TICKET LOGS Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطا در دریافت لاگ تیکت."

            });

        }

    }
);

// ============================================================
// OWNER - DELETE ALL LOGS
// ============================================================

app.delete(
    "/logs",
    requireOwner,
    async (req, res) => {

        try {

            const result =
                await logs.deleteMany({});


            // ------------------------------------------------
            // تلاش برای ثبت Log حذف Logs
            // ------------------------------------------------

            try {

                await createLog({

                    action:
                        "ALL_LOGS_DELETED",

                    actor:
                        req.user,

                    details: {

                        deletedCount:
                            result.deletedCount

                    }

                });

            } catch {

                // intentionally ignored

            }


            return res.json({

                success:
                    true,

                deletedCount:
                    result.deletedCount

            });


        } catch (error) {

            console.error(
                "❌ DELETE /logs Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطا در حذف لاگ‌ها."

            });

        }

    }
);

// ============================================================
// API 404
// ============================================================
//
// مهم:
// اینجا از app.options("*") یا app.all("*")
// استفاده نشده چون Express 5 / path-to-regexp
// روی wildcard قدیمی خطا می‌دهد.
//
// ============================================================

app.use(
    (req, res, next) => {

        const isApi =

            req.path.startsWith(
                "/auth/"
            ) ||

            req.path ===
                "/tickets" ||

            req.path.startsWith(
                "/tickets/"
            ) ||

            req.path ===
                "/logs" ||

            req.path.startsWith(
                "/logs/"
            );


        if (isApi) {

            return res.status(404).json({

                success: false,

                message:
                    "مسیر API پیدا نشد."

            });

        }


        next();

    }
);

// ============================================================
// GLOBAL ERROR
// ============================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "❌ GLOBAL ERROR:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        return res.status(500).json({

            success: false,

            message:
                "خطای داخلی سرور."

        });

    }
);

// ============================================================
// START SERVER
// ============================================================

async function startServer() {

    try {

        // ----------------------------------------------------
        // CONNECT MONGODB
        // ----------------------------------------------------

        await client.connect();


        console.log(
            "🍃 MongoDB Connected ✅"
        );


        // ----------------------------------------------------
        // DATABASE
        // ----------------------------------------------------

        database =
            client.db("LSPD");


        // ----------------------------------------------------
        // COLLECTIONS
        // ----------------------------------------------------

        tickets =
            database.collection(
                "tickets"
            );


        logs =
            database.collection(
                "logs"
            );


        // ----------------------------------------------------
        // INDEXES
        // ----------------------------------------------------

        try {

            await logs.createIndex({

                createdAt:
                    -1

            });


            await logs.createIndex({

                ticketId:
                    1

            });


            await logs.createIndex({

                "actor.username":
                    1

            });


            await logs.createIndex({

                action:
                    1

            });


            await tickets.createIndex({

                createdAt:
                    -1

            });


            console.log(
                "📊 MongoDB Indexes Ready ✅"
            );


        } catch (indexError) {

            console.warn(

                "⚠️ Index warning:",

                indexError.message

            );

        }


        // ----------------------------------------------------
        // START HTTP
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
                    "🔐 Authentication: Enabled"
                );

                console.log(
                    "👮 Command: LSPD"
                );

                console.log(
                    "👑 Owner: SEDJAVAD"
                );

                console.log(
                    "🎫 Tickets: Enabled"
                );

                console.log(
                    "💬 Chat: Enabled"
                );

                console.log(
                    "📋 Logs: Enabled"
                );

                console.log(
                    "🔑 Stable Token Secret: Enabled"
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
// GRACEFUL SHUTDOWN
// ============================================================

async function shutdown(signal) {

    console.log(
        `🛑 ${signal} received. Closing server...`
    );


    try {

        await client.close();

        console.log(
            "🍃 MongoDB connection closed."
        );

    } catch (error) {

        console.error(
            "❌ Shutdown Error:",
            error
        );

    }


    process.exit(0);

}


process.on(
    "SIGINT",
    () =>
        shutdown("SIGINT")
);


process.on(
    "SIGTERM",
    () =>
        shutdown("SIGTERM")
);

// ============================================================
// RUN
// ============================================================

startServer();
