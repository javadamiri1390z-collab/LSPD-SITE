// ============================================================
// VANGUARD LSPD - SERVER.JS
// MongoDB + Authentication + Command + Owner + Logs
// نسخه هماهنگ با command-login.html و command.html
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
// ACCOUNTS
// ============================================================

const COMMAND_USERNAME = "LSPD";
const COMMAND_PASSWORD = "LSPD00078";
const COMMAND_NAME = process.env.COMMAND_NAME || "Vanguard Command";
const COMMAND_RANK = process.env.COMMAND_RANK || "Commander";

const OWNER_USERNAME = "SEDJAVAD";
const OWNER_PASSWORD = "SEDJAVAD00078";
const OWNER_NAME = process.env.OWNER_NAME || "SEDJAVAD";
const OWNER_RANK = process.env.OWNER_RANK || "LSPD High Command";

// ============================================================
// TOKEN SECRET
// ============================================================

const TOKEN_SECRET =
    process.env.TOKEN_SECRET ||
    crypto.randomBytes(32).toString("hex");

// ============================================================
// MIDDLEWARE
// ============================================================

app.set("trust proxy", 1);

app.use(
    cors({
        origin: true,
        credentials: false
    })
);

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "2mb"
    })
);

// ============================================================
// STATIC FILES
// ============================================================

app.use(express.static(__dirname));

// ============================================================
// MONGODB
// ============================================================

const client = new MongoClient(MONGO_URI);

let database = null;
let tickets = null;
let logs = null;

// ============================================================
// HELPERS
// ============================================================

function text(value) {
    return String(value ?? "").trim();
}

function normalizeUsername(value) {
    return text(value).toLowerCase();
}

function now() {
    return new Date();
}

function safeObjectId(id) {
    if (!id || !ObjectId.isValid(id)) {
        return null;
    }

    return new ObjectId(id);
}

function publicUser(user) {
    return {
        username: user.username,
        name: user.name,
        rank: user.rank,
        role: user.role,
        isOwner: user.role === "owner"
    };
}

// ============================================================
// TOKEN SYSTEM
// ============================================================

function createToken(user) {
    const payload = {
        username: user.username,
        name: user.name,
        rank: user.rank,
        role: user.role,
        isOwner: user.role === "owner",
        issuedAt: Date.now()
    };

    const encoded = Buffer
        .from(JSON.stringify(payload))
        .toString("base64url");

    const signature = crypto
        .createHmac("sha256", TOKEN_SECRET)
        .update(encoded)
        .digest("base64url");

    return `${encoded}.${signature}`;
}

function verifyToken(token) {
    try {
        token = text(token);

        if (!token) {
            return null;
        }

        const parts = token.split(".");

        if (parts.length !== 2) {
            return null;
        }

        const [encoded, signature] = parts;

        const expected = crypto
            .createHmac("sha256", TOKEN_SECRET)
            .update(encoded)
            .digest("base64url");

        if (
            signature.length !== expected.length ||
            !crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expected)
            )
        ) {
            return null;
        }

        const payload = JSON.parse(
            Buffer
                .from(encoded, "base64url")
                .toString("utf8")
        );

        if (
            !payload.issuedAt ||
            Date.now() - Number(payload.issuedAt) >
            24 * 60 * 60 * 1000
        ) {
            return null;
        }

        if (
            !payload.username ||
            !["command", "owner"].includes(payload.role)
        ) {
            return null;
        }

        return payload;

    } catch (error) {
        console.error("Token Verify Error:", error.message);
        return null;
    }
}

function getTokenFromRequest(req) {
    const authorization = text(req.headers.authorization);

    if (
        authorization &&
        authorization.toLowerCase().startsWith("bearer ")
    ) {
        return authorization.substring(7).trim();
    }

    const customToken = text(req.headers["x-admin-token"]);

    if (customToken) {
        return customToken;
    }

    return "";
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function requireAuth(req, res, next) {
    const user = verifyToken(getTokenFromRequest(req));

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "دسترسی غیرمجاز. لطفاً دوباره وارد شوید."
        });
    }

    req.user = user;
    next();
}

function requireCommand(req, res, next) {
    const user = verifyToken(getTokenFromRequest(req));

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "جلسه ورود معتبر نیست. دوباره وارد شوید."
        });
    }

    if (
        user.role !== "command" &&
        user.role !== "owner"
    ) {
        return res.status(403).json({
            success: false,
            message: "شما دسترسی فرماندهی ندارید."
        });
    }

    req.user = user;
    next();
}

function requireOwner(req, res, next) {
    const user = verifyToken(getTokenFromRequest(req));

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "جلسه ورود معتبر نیست. دوباره وارد شوید."
        });
    }

    if (user.role !== "owner") {
        return res.status(403).json({
            success: false,
            message: "این بخش فقط برای مالک سیستم است."
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
            console.warn("⚠️ Logs collection آماده نیست.");
            return;
        }

        const log = {
            action: text(action),
            ticketId: ticketId ? String(ticketId) : null,

            actor: {
                type: actor?.role || "system",
                username: actor?.username || "System",
                name: actor?.name || "System",
                rank: actor?.rank || "System"
            },

            details: details || {},
            createdAt: now()
        };

        await logs.insertOne(log);

        console.log(
            "📝 LOG:",
            log.action,
            "|",
            log.actor.username,
            "|",
            log.actor.name
        );

    } catch (error) {
        console.error("❌ Create Log Error:", error);
    }
}

// ============================================================
// HTML ROUTES
// ============================================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/index.html", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/command", (req, res) => {
    res.sendFile(path.join(__dirname, "command.html"));
});

app.get("/command.html", (req, res) => {
    res.sendFile(path.join(__dirname, "command.html"));
});

app.get("/command-login", (req, res) => {
    res.sendFile(path.join(__dirname, "command-login.html"));
});

app.get("/command-login.html", (req, res) => {
    res.sendFile(path.join(__dirname, "command-login.html"));
});

// ============================================================
// LOGIN
// ============================================================

app.post("/auth/login", async (req, res) => {
    try {
        const usernameRaw = text(req.body?.username);
        const password = text(req.body?.password);

        const username = normalizeUsername(usernameRaw);

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "نام کاربری و رمز عبور الزامی است."
            });
        }

        let user = null;

        if (
            username === normalizeUsername(OWNER_USERNAME) &&
            password === OWNER_PASSWORD
        ) {
            user = {
                username: OWNER_USERNAME,
                name: OWNER_NAME,
                rank: OWNER_RANK,
                role: "owner"
            };
        }

        else if (
            username === normalizeUsername(COMMAND_USERNAME) &&
            password === COMMAND_PASSWORD
        ) {
            user = {
                username: COMMAND_USERNAME,
                name: COMMAND_NAME,
                rank: COMMAND_RANK,
                role: "command"
            };
        }

        else {
            await createLog({
                action: "LOGIN_FAILED",
                actor: {
                    role: "unknown",
                    username: usernameRaw,
                    name: usernameRaw,
                    rank: "Unknown"
                },
                details: {
                    ip: req.ip
                }
            });

            return res.status(401).json({
                success: false,
                message: "نام کاربری یا رمز عبور اشتباه است."
            });
        }

        const token = createToken(user);

        await createLog({
            action: "LOGIN_SUCCESS",
            actor: user,
            details: {
                ip: req.ip
            }
        });

        return res.json({
            success: true,
            token,
            user: publicUser(user)
        });

    } catch (error) {
        console.error("LOGIN ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "خطا در ورود"
        });
    }
});

// ============================================================
// AUTH ME
// ============================================================

app.get("/auth/me", requireAuth, async (req, res) => {
    return res.json({
        success: true,
        user: publicUser(req.user)
    });
});// ============================================================
// CREATE TICKET - PUBLIC
// ============================================================

app.post("/tickets", async (req, res) => {
    try {
        const body = req.body || {};

        const requestType = text(
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
            const numberScore = Number(body.score);

            if (
                Number.isFinite(numberScore) &&
                numberScore >= 0 &&
                numberScore <= 20
            ) {
                score = numberScore;
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

            ocName: text(body.ocName),

            icName: text(
                body.icName ||
                body.name
            ),

            name: text(
                body.icName ||
                body.name
            ),

            discord: text(
                body.discord ||
                body.discordId
            ),

            discordId: text(
                body.discordId ||
                body.discord
            ),

            steamHex: text(body.steamHex),
            cmx: text(body.cmx),
            age: text(body.age),

            experience: text(body.experience),
            reason: text(body.reason),

            currentDivision: text(body.currentDivision),
            requestedDivision: text(body.requestedDivision),
            reasonForRequest: text(body.reasonForRequest),

            previousDivisionExperience:
                text(body.previousDivisionExperience),

            additionalInformation:
                text(body.additionalInformation),

            oocName: text(body.oocName),
            rank: text(body.rank),
            callSign: text(body.callSign),

            resignationReason: text(
                body.resignationReason ||
                body.reason
            ),

            requestRank: text(body.requestRank),

            currentRankTimeplay:
                text(body.currentRankTimeplay),

            note: text(body.note),

            score,
            passed,
            passingScore: 12,

            status: "Pending",

            reply: "در انتظار پاسخ فرماندهی",

            messages: [],

            createdAt: now(),
            updatedAt: now()
        };

        const result = await tickets.insertOne(ticket);

        const ticketId =
            result.insertedId.toString();

        await createLog({
            action: "TICKET_CREATED",
            ticketId,

            actor: {
                role: "applicant",

                username:
                    ticket.discord ||
                    "Applicant",

                name:
                    ticket.icName ||
                    ticket.ocName ||
                    "Applicant",

                rank: "Applicant"
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
            success: true,
            id: ticketId,
            score,
            passed
        });

    } catch (error) {
        console.error(
            "POST /tickets Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "خطا در ثبت درخواست"
        });
    }
});

// ============================================================
// GET ALL TICKETS
// COMMAND + OWNER
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
                "GET /tickets Error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "خطا در دریافت درخواست‌ها"
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
                "GET SINGLE TICKET Error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "خطا در دریافت درخواست"
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
                ticket.status ||
                "Pending";

            const oldReply =
                ticket.reply ||
                "";

            const status =
                text(req.body?.status) ||
                "Pending";

            const reply =
                text(req.body?.reply);

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
                        "وضعیت نامعتبر است"
                });
            }

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
                success: true
            });

        } catch (error) {

            console.error(
                "PUT /tickets Error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "خطا در بروزرسانی تیکت"
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

            const result =
                await tickets.deleteOne({
                    _id: id
                });

            if (!result.deletedCount) {

                return res.status(404).json({
                    success: false,
                    message:
                        "تیکت حذف نشد"
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

                success: true,

                message:
                    "تیکت با موفقیت حذف شد."

            });

        } catch (error) {

            console.error(
                "DELETE /tickets Error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در حذف تیکت"

            });
        }
    }
);// ============================================================
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

            return res.json(
                ticket.messages || []
            );

        } catch (error) {

            console.error(
                "GET MESSAGES Error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در دریافت چت"

            });
        }
    }
);

// ============================================================
// SEND CHAT MESSAGE
//
// applicant = public
// command/owner = requires login
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
                text(
                    req.body?.message
                );

            if (!message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "پیام خالی است"

                });
            }

            if (message.length > 3000) {

                return res.status(400).json({

                    success: false,

                    message:
                        "پیام بیش از حد طولانی است"

                });
            }

            const requestedSender =
                text(
                    req.body?.sender
                ).toLowerCase();

            let sender =
                "applicant";

            let commandUser =
                null;

            if (
                requestedSender ===
                "command"
            ) {

                commandUser =
                    verifyToken(
                        getTokenFromRequest(
                            req
                        )
                    );

                if (!commandUser) {

                    return res.status(401).json({

                        success: false,

                        message:
                            "برای ارسال پیام فرماندهی ابتدا وارد شوید."

                    });
                }

                if (
                    commandUser.role !==
                        "command" &&
                    commandUser.role !==
                        "owner"
                ) {

                    return res.status(403).json({

                        success: false,

                        message:
                            "دسترسی فرماندهی ندارید."

                    });
                }

                sender =
                    "command";
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

            const chatMessage = {

                message,

                sender,

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

            await createLog({

                action:
                    sender ===
                    "command"

                        ? "COMMAND_MESSAGE_SENT"

                        : "APPLICANT_MESSAGE_SENT",

                ticketId:
                    id.toString(),

                actor:

                    sender ===
                    "command"

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
                "POST MESSAGE Error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در ارسال پیام"

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
                "GET /logs Error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در دریافت لاگ‌ها"

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

            return res.json({

                success:
                    true,

                logs:
                    data

            });

        } catch (error) {

            console.error(

                "GET TICKET LOGS Error:",

                error

            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در دریافت لاگ تیکت"

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

            return res.json({

                success:
                    true,

                deletedCount:
                    result.deletedCount

            });

        } catch (error) {

            console.error(
                "DELETE /logs Error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در حذف لاگ‌ها"

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
                true,

            time:
                now()

        });
    }
);

// ============================================================
// API 404
// ============================================================

app.use(
    (req, res, next) => {

        if (

            req.path.startsWith(
                "/auth/"
            ) ||

            req.path.startsWith(
                "/tickets"
            ) ||

            req.path.startsWith(
                "/logs"
            )

        ) {

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
            "GLOBAL ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "خطای داخلی سرور"

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
                "MongoDB Indexes Ready ✅"
            );

        } catch (indexError) {

            console.warn(

                "⚠️ Index warning:",

                indexError.message

            );
        }

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
                    "👮 Command: LSPD / LSPD00078"
                );

                console.log(
                    "👑 Owner: SEDJAVAD / SEDJAVAD00078"
                );

                console.log(
                    "🗑️ Owner Delete: Enabled"
                );

                console.log(
                    "📋 Owner Logs: Enabled"
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

    } catch (error) {

        console.error(error);

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
