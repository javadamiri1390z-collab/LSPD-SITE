// ============================================================
// VANGUARD LSPD - SERVER.JS
// MongoDB + Authentication + Tickets + Command Logs
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

if (!MONGO_URI) {
    console.error("❌ MONGODB_URI تنظیم نشده است.");
    process.exit(1);
}


// ============================================================
// COMMAND ACCOUNT
// ============================================================

const COMMAND_USERNAME =
    process.env.COMMAND_USERNAME || "LSPD";

const COMMAND_PASSWORD =
    process.env.COMMAND_PASSWORD || "LSPD00078";

const COMMAND_NAME =
    process.env.COMMAND_NAME || "Vanguard Command";

const COMMAND_RANK =
    process.env.COMMAND_RANK || "Commander";


// ============================================================
// OWNER ACCOUNT
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
// TOKEN SECRET
// ============================================================

const TOKEN_SECRET =
    process.env.TOKEN_SECRET ||
    crypto.randomBytes(32).toString("hex");


// ============================================================
// MIDDLEWARE
// ============================================================

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

app.use(
    express.urlencoded({
        extended: true
    })
);

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
    return String(value ?? "").trim();
}


function now() {
    return new Date();
}


function safeObjectId(id) {

    if (!ObjectId.isValid(id)) {
        return null;
    }

    return new ObjectId(id);
}


function normalizeUsername(username) {

    return text(username).toUpperCase();

}


// ============================================================
// USER OBJECT
// ============================================================

function publicUser(user) {

    if (!user) {
        return null;
    }

    return {
        username: user.username || "",
        name: user.name || "",
        rank: user.rank || "",
        role: user.role || "",
        isOwner: user.role === "owner"
    };

}


// ============================================================
// TOKEN CREATE
// ============================================================

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


    return encoded + "." + signature;

}


// ============================================================
// TOKEN VERIFY
// ============================================================

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

        const receivedSignature =
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
            receivedSignature.length !==
            expectedSignature.length
        ) {

            return null;

        }


        const valid =
            crypto.timingSafeEqual(
                Buffer.from(
                    receivedSignature
                ),
                Buffer.from(
                    expectedSignature
                )
            );


        if (!valid) {
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


        if (!payload.issuedAt) {
            return null;
        }


        const age =
            Date.now() -
            Number(payload.issuedAt);


        if (
            !Number.isFinite(age) ||
            age < 0 ||
            age >
            24 * 60 * 60 * 1000
        ) {

            return null;

        }


        if (
            !payload.username ||
            !payload.role
        ) {

            return null;

        }


        return payload;

    } catch (error) {

        console.error(
            "Token verification error:",
            error.message
        );

        return null;

    }

}


// ============================================================
// GET TOKEN
// ============================================================

function getTokenFromRequest(req) {

    const authorization =
        text(
            req.headers.authorization
        );


    if (
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
                "دسترسی غیرمجاز. لطفاً وارد شوید."

        });

    }


    req.user = user;

    next();

}


// ============================================================
// COMMAND MIDDLEWARE
// ============================================================

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


// ============================================================
// OWNER MIDDLEWARE
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
                "ابتدا وارد شوید."

        });

    }


    if (user.role !== "owner") {

        return res.status(403).json({

            success: false,

            message:
                "این بخش فقط برای Owner قابل دسترسی است."

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
                "⚠️ Logs collection آماده نیست."
            );

            return;

        }


        const safeActor = {

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

        };


        const log = {

            action:
                text(action),

            ticketId:
                ticketId
                    ? String(ticketId)
                    : null,

            actor:
                safeActor,

            // برای سازگاری بیشتر
            // commander هم ذخیره می‌شود.

            commander:
                safeActor,

            details:
                details || {},

            createdAt:
                now()

        };


        await logs.insertOne(log);


        console.log(
            "📝 LOG:",
            log.action,
            "|",
            safeActor.username,
            "|",
            safeActor.name,
            "|",
            safeActor.rank
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

app.post(
    "/auth/login",
    async (req, res) => {

        try {

            const username =
                text(
                    req.body?.username
                );

            const password =
                text(
                    req.body?.password
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


            const normalizedUsername =
                normalizeUsername(
                    username
                );


            let user = null;


            // =================================================
            // OWNER
            // =================================================

            if (
                normalizedUsername ===
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


            // =================================================
            // COMMAND
            // =================================================

            else if (
                normalizedUsername ===
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


            // =================================================
            // WRONG LOGIN
            // =================================================

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
                            req.ip,

                        userAgent:
                            text(
                                req.headers[
                                    "user-agent"
                                ]
                            )

                    }

                });


                return res.status(401).json({

                    success: false,

                    message:
                        "نام کاربری یا رمز عبور اشتباه است."

                });

            }


            // =================================================
            // CREATE TOKEN
            // =================================================

            const token =
                createToken(user);


            await createLog({

                action:
                    "LOGIN_SUCCESS",

                actor:
                    user,

                details: {

                    ip:
                        req.ip,

                    userAgent:
                        text(
                            req.headers[
                                "user-agent"
                            ]
                        )

                }

            });


            return res.json({

                success: true,

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
                    "خطا در ورود به سیستم."

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

            success: true,

            user:
                publicUser(
                    req.user
                )

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


            return res.json(data);

        } catch (error) {

            console.error(
                "❌ GET /tickets:",
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
                        "درخواست پیدا نشد."

                });

            }


            return res.json(ticket);

        } catch (error) {

            console.error(
                "❌ GET SINGLE TICKET:",
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
// CREATE TICKET
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


            // =================================================
            // SCORE
            // =================================================

            let score = null;


            if (
                body.score !== undefined &&
                body.score !== null &&
                body.score !== ""
            ) {

                const numericScore =
                    Number(
                        body.score
                    );


                if (
                    Number.isFinite(
                        numericScore
                    ) &&
                    numericScore >= 0 &&
                    numericScore <= 20
                ) {

                    score =
                        numericScore;

                }

            }


            const passed =
                body.passed === true ||
                (
                    score !== null &&
                    score >= 12
                );


            // =================================================
            // CREATE TICKET
            // =================================================

            const ticket = {

                requestType,


                // ---------------------------------------------
                // BASIC
                // ---------------------------------------------

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


                // ---------------------------------------------
                // MEMBERSHIP
                // ---------------------------------------------

                experience:
                    text(
                        body.experience
                    ),

                reason:
                    text(
                        body.reason
                    ),


                // ---------------------------------------------
                // DIVISION
                // ---------------------------------------------

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


                // ---------------------------------------------
                // RESIGNATION
                // ---------------------------------------------

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


                // ---------------------------------------------
                // RANKUP
                // ---------------------------------------------

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


                // ---------------------------------------------
                // EXAM
                // ---------------------------------------------

                score,

                passed,

                passingScore:
                    12,


                // ---------------------------------------------
                // STATUS
                // ---------------------------------------------

                status:
                    "Pending",


                reply:
                    "در انتظار پاسخ فرماندهی",


                // ---------------------------------------------
                // CHAT
                // ---------------------------------------------

                messages: [],


                // ---------------------------------------------
                // DATES
                // ---------------------------------------------

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


            // =================================================
            // AUTO LOG
            // =================================================

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

                    icName:
                        ticket.icName,

                    ocName:
                        ticket.ocName,

                    score,

                    passed

                }

            });


            return res.json({

                success: true,

                id:
                    ticketId,

                score,

                passed

            });

        } catch (error) {

            console.error(
                "❌ POST /tickets:",
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


            const oldStatus =
                ticket.status || "Pending";


            const oldReply =
                ticket.reply || "";


            const requestedStatus =
                text(
                    req.body?.status
                );


            const allowedStatuses = [
                "Pending",
                "Accepted",
                "Rejected"
            ];


            const status =
                allowedStatuses.includes(
                    requestedStatus
                )
                    ? requestedStatus
                    : "Pending";


            const reply =
                text(
                    req.body?.reply
                );


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


            // =================================================
            // LOG STATUS
            // =================================================

            if (
                oldStatus !==
                status
            ) {

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
                            status,

                        ticketOwner:
                            ticket.icName ||
                            ticket.name ||
                            "Unknown"

                    }

                });

            }


            // =================================================
            // LOG REPLY
            // =================================================

            if (
                oldReply !==
                reply
            ) {

                await createLog({

                    action:
                        "TICKET_REPLY_UPDATED",

                    ticketId:
                        id.toString(),

                    actor:
                        req.user,

                    details: {

                        reply,

                        status,

                        ticketOwner:
                            ticket.icName ||
                            ticket.name ||
                            "Unknown"

                    }

                });

            }


            return res.json({

                success: true,

                ticket: {

                    ...ticket,

                    _id:
                        id,

                    status,

                    reply

                }

            });

        } catch (error) {

            console.error(
                "❌ PUT /tickets:",
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
// GET MESSAGES
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
                        "شناسه تیکت نامعتبر است."

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
                        "تیکت پیدا نشد."

                });

            }


            return res.json(
                ticket.messages || []
            );

        } catch (error) {

            console.error(
                "❌ GET MESSAGES:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "خطا در دریافت پیام‌ها."

            });

        }

    }
);


// ============================================================
// SEND MESSAGE
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
                        "شناسه تیکت نامعتبر است."

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
                        "پیام نمی‌تواند خالی باشد."

                });

            }


            if (
                message.length >
                2000
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "پیام نمی‌تواند بیشتر از ۲۰۰۰ کاراکتر باشد."

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


            // =================================================
            // DETECT AUTHENTICATED COMMAND
            // =================================================

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
                            "دسترسی غیرمجاز."

                    });

                }


                sender =
                    "command";


                actor =
                    authenticatedUser;

            }


            // =================================================
            // MESSAGE
            // =================================================

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


            if (
                !result.matchedCount
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "تیکت پیدا نشد."

                });

            }


            // =================================================
            // AUTO LOG
            // =================================================

            await createLog({

                action:
                    sender === "command"
                        ? "COMMAND_MESSAGE_SENT"
                        : "APPLICANT_MESSAGE_SENT",

                ticketId:
                    id.toString(),

                actor,

                details: {

                    message,

                    ticketOwner:
                        ticket.icName ||
                        ticket.name ||
                        "Unknown"

                }

            });


            return res.json({

                success: true,

                message:
                    chatMessage

            });

        } catch (error) {

            console.error(
                "❌ POST MESSAGE:",
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
// DELETE TICKET - OWNER ONLY
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
                result.deletedCount !== 1
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


            return res.json({

                success: true

            });

        } catch (error) {

            console.error(
                "❌ DELETE TICKET:",
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
// GET LOGS - OWNER ONLY
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


            // مهم:
            // admin.html فعلی انتظار آرایه مستقیم دارد.

            return res.json(data);

        } catch (error) {

            console.error(
                "❌ GET LOGS:",
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
// GET TICKET LOGS - OWNER ONLY
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

                        createdAt: 1

                    })
                    .toArray();


            return res.json(data);

        } catch (error) {

            console.error(
                "❌ GET TICKET LOGS:",
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
// HEALTH
// ============================================================

app.get(
    "/health",
    async (req, res) => {

        let mongoStatus =
            false;


        try {

            if (database) {

                await database.command({
                    ping: 1
                });

                mongoStatus =
                    true;

            }

        } catch (error) {

            mongoStatus =
                false;

        }


        return res.json({

            success:
                mongoStatus,

            server:
                "Vanguard LSPD",

            mongodb:
                mongoStatus,

            auth:
                true,

            logs:
                !!logs,

            time:
                now()

        });

    }
);


// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        return res.status(404).json({

            success: false,

            message:
                "Route پیدا نشد."

        });

    }
);


// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "❌ GLOBAL ERROR:",
            error
        );


        if (res.headersSent) {
            return next(error);
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

        console.log(
            "⏳ Connecting to MongoDB..."
        );


        await client.connect();


        await client.db(
            "admin"
        ).command({
            ping: 1
        });


        console.log(
            "🍃 MongoDB Connected ✅"
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


        // =====================================================
        // INDEXES
        // =====================================================

        try {

            await logs.createIndex({

                createdAt: -1

            });


            await logs.createIndex({

                ticketId: 1

            });


            await logs.createIndex({

                "actor.username": 1

            });


            await tickets.createIndex({

                createdAt: -1

            });


            console.log(
                "📚 MongoDB Indexes Ready ✅"
            );

        } catch (indexError) {

            console.warn(
                "⚠️ Index warning:",
                indexError.message
            );

        }


        // =====================================================
        // SERVER
        // =====================================================

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
                    "📝 Command Logs: Enabled"
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
            "❌ MongoDB Connection Error:"
        );

        console.error(
            error
        );


        process.exit(1);

    }

}


// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

async function shutdown() {

    console.log(
        "🛑 Closing server..."
    );


    try {

        await client.close();

        console.log(
            "🍃 MongoDB connection closed."
        );

    } catch (error) {

        console.error(
            "Shutdown error:",
            error
        );

    }


    process.exit(0);

}


process.on(
    "SIGINT",
    shutdown
);


process.on(
    "SIGTERM",
    shutdown
);


// ============================================================
// RUN
// ============================================================

startServer();
