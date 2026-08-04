// ===================================
// Vanguard LSPD System
// MongoDB Ticket + Tracking + Chat Server
// CLOSED TICKETS SUPPORT
// ===================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const {
    MongoClient,
    ObjectId
} = require("mongodb");

const app = express();

// ===================================
// MIDDLEWARE
// ===================================

app.use(cors({
    origin: true,
    credentials: false
}));

app.use(express.json({
    limit: "2mb"
}));

app.use(express.urlencoded({
    extended: true
}));

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
// HEALTH
// ===================================

app.get("/health", (req, res) => {

    res.json({
        success: true,
        message: "Vanguard LSPD API is online",
        time: new Date().toISOString()
    });

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

let database;
let tickets;
let messagesCollection;

// ===================================
// HELPERS
// ===================================

function text(value) {

    return String(
        value ?? ""
    ).trim();

}

function safeObjectId(id) {

    if (
        !id ||
        !ObjectId.isValid(id)
    ) {

        return null;

    }

    return new ObjectId(id);

}

function normalizeRequestType(type) {

    const value =
        text(type).toLowerCase();

    const allowed = [
        "membership",
        "division",
        "resignation",
        "rankup",
        "exam"
    ];

    if (
        allowed.includes(value)
    ) {

        return value;

    }

    return "membership";

}

function normalizeStatus(status) {

    const value =
        text(status);

    const allowed = [
        "Pending",
        "Accepted",
        "Rejected",
        "Closed"
    ];

    if (
        allowed.includes(value)
    ) {

        return value;

    }

    return "Pending";

}

// ===================================
// START SERVER
// ===================================

async function startServer() {

    try {

        await client.connect();

        console.log(
            "🍃 MongoDB Connected ✅"
        );

        database =
            client.db("LSPD");

        tickets =
            database.collection(
                "tickets"
            );

        messagesCollection =
            database.collection(
                "messages"
            );

        // ===================================
        // INDEXES
        // ===================================

        try {

            await tickets.createIndex({
                createdAt: -1
            });

            await tickets.createIndex({
                status: 1
            });

            await tickets.createIndex({
                closedAt: -1
            });

            await messagesCollection.createIndex({
                ticketId: 1,
                createdAt: 1
            });

            console.log(
                "📊 MongoDB Indexes Ready ✅"
            );

        } catch (indexError) {

            console.error(
                "⚠️ MongoDB Index Error:",
                indexError
            );

        }

        // ==========================================================
        // GET ALL TICKETS
        // ==========================================================

        app.get(
            "/tickets",
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

        // ==========================================================
        // GET SINGLE TICKET
        // ==========================================================

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
                                "تیکت پیدا نشد"

                        });

                    }

                    res.json(ticket);

                } catch (error) {

                    console.error(
                        "GET /tickets/:id Error:",
                        error
                    );

                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در دریافت تیکت"

                    });

                }

            }
        );

        // ==========================================================
        // CREATE NEW TICKET
        // ==========================================================

        app.post(
            "/tickets",
            async (req, res) => {

                try {

                    const body =
                        req.body || {};

                    const requestType =
                        normalizeRequestType(
                            body.requestType ||
                            body.type ||
                            "membership"
                        );

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

                        oocName:
                            text(
                                body.oocName
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

                        score:
                            body.score !== undefined &&
                            body.score !== null &&
                            text(body.score) !== ""
                                ? Number(body.score)
                                : null,

                        status:
                            "Pending",

                        reply:
                            "در انتظار پاسخ فرماندهی",

                        closedAt:
                            null,

                        closedBy:
                            null,

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
                        "🎫 New Ticket:",
                        ticketId,
                        "| Type:",
                        requestType
                    );

                    res.status(201).json({

                        success: true,

                        id:
                            ticketId,

                        ticketId:
                            ticketId,

                        message:
                            "درخواست با موفقیت ثبت شد."

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

        // ==========================================================
        // UPDATE TICKET
        // PUT /tickets/:id
        // ==========================================================

        app.put(
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
                                "شناسه تیکت نامعتبر است"

                        });

                    }

                    const status =
                        normalizeStatus(
                            req.body?.status
                        );

                    const reply =
                        text(
                            req.body?.reply
                        );

                    const commanderName =
                        text(
                            req.body?.commanderName
                        );

                    const commanderRank =
                        text(
                            req.body?.commanderRank
                        );

                    const commanderUsername =
                        text(
                            req.body?.commanderUsername
                        );

                    const updateData = {

                        status,

                        reply,

                        updatedAt:
                            new Date()

                    };

                    // ===================================
                    // CLOSE TICKET
                    // ===================================

                    if (status === "Closed") {

                        updateData.closedAt =
                            new Date();

                        updateData.closedBy = {

                            name:
                                commanderName,

                            rank:
                                commanderRank,

                            username:
                                commanderUsername

                        };

                    }

                    // ===================================
                    // REOPEN TICKET
                    // ===================================

                    if (
                        status !== "Closed"
                    ) {

                        updateData.closedAt =
                            null;

                        updateData.closedBy =
                            null;

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

                    if (
                        result.matchedCount === 0
                    ) {

                        return res.status(404).json({

                            success: false,

                            message:
                                "تیکت پیدا نشد"

                        });

                    }

                    res.json({

                        success: true,

                        message:
                            status === "Closed"
                                ? "تیکت با موفقیت بسته شد."
                                : "تیکت با موفقیت بروزرسانی شد."

                    });

                } catch (error) {

                    console.error(
                        "PUT /tickets/:id Error:",
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

        // ==========================================================
        // GET TICKET MESSAGES
        // ==========================================================

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

                    const messages =
                        await messagesCollection
                            .find({

                                ticketId:
                                    id.toString()

                            })
                            .sort({
                                createdAt: 1
                            })
                            .toArray();

                    res.json(
                        messages
                    );

                } catch (error) {

                    console.error(
                        "GET messages Error:",
                        error
                    );

                    res.status(500).json({

                        success: false,

                        message:
                            "خطا در دریافت پیام‌ها"

                    });

                }

            }
        );

        // ==========================================================
        // SEND TICKET MESSAGE
        // ==========================================================

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

                    const message =
                        text(
                            req.body?.message
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
                                "پیام نمی‌تواند بیشتر از ۲۰۰۰ کاراکتر باشد"

                        });

                    }

                    let sender =
                        text(
                            req.body?.sender
                        ).toLowerCase();

                    if (
                        sender !== "command" &&
                        sender !== "applicant"
                    ) {

                        sender =
                            "applicant";

                    }

                    const commanderName =
                        text(
                            req.body?.commanderName
                        );

                    const commanderRank =
                        text(
                            req.body?.commanderRank
                        );

                    const commanderUsername =
                        text(
                            req.body?.commanderUsername
                        );

                    const newMessage = {

                        ticketId:
                            id.toString(),

                        sender,

                        message,

                        commanderName:
                            sender === "command"
                                ? commanderName
                                : "",

                        commanderRank:
                            sender === "command"
                                ? commanderRank
                                : "",

                        commanderUsername:
                            sender === "command"
                                ? commanderUsername
                                : "",

                        senderName:
                            sender === "command"
                                ? commanderName || "فرماندهی"
                                : "متقاضی",

                        senderRank:
                            sender === "command"
                                ? commanderRank
                                : "",

                        createdAt:
                            new Date()

                    };

                    const result =
                        await messagesCollection
                            .insertOne(
                                newMessage
                            );

                    res.status(201).json({

                        success: true,

                        id:
                            result.insertedId.toString(),

                        message:
                            "پیام با موفقیت ارسال شد."

                    });

                } catch (error) {

                    console.error(
                        "POST messages Error:",
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

        // ==========================================================
        // DELETE TICKET
        // ==========================================================

        app.delete(
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
                                "شناسه تیکت نامعتبر است"

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
                                "تیکت پیدا نشد"

                        });

                    }

                    await messagesCollection.deleteMany({

                        ticketId:
                            id.toString()

                    });

                    res.json({

                        success: true,

                        message:
                            "تیکت با موفقیت حذف شد."

                    });

                } catch (error) {

                    console.error(
                        "DELETE Ticket Error:",
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

        // ==========================================================
        // 404 API
        // ==========================================================

        app.use(
            (req, res, next) => {

                if (
                    req.path.startsWith("/tickets")
                ) {

                    return res.status(404).json({

                        success: false,

                        message:
                            "مسیر API پیدا نشد"

                    });

                }

                next();

            }
        );

        // ==========================================================
        // START SERVER
        // ==========================================================

        const PORT =
            process.env.PORT || 3000;

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
                    "🎫 Tickets: Enabled"
                );

                console.log(
                    "💬 Chat: Enabled"
                );

                console.log(
                    "📋 Tracking API: Enabled"
                );

                console.log(
                    "🔒 Closed Tickets: Enabled"
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

startServer();
