// ===================================
// Vanguard LSPD System
// MongoDB Ticket + Tracking + Chat Server
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
        path.join(
            __dirname,
            "index.html"
        )
    );

});


// ===================================
// HEALTH CHECK
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


// ===================================
// START SERVER
// ===================================

async function startServer() {

    try {

        // ===================================
        // CONNECT MONGODB
        // ===================================

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
        // مهم برای tracking.html
        // GET /tickets/:id
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
        // POST /tickets
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


                    // ===================================
                    // CREATE TICKET
                    // ===================================

                    const ticket = {

                        // -----------------------------------
                        // Request
                        // -----------------------------------

                        requestType:
                            requestType,


                        // -----------------------------------
                        // Common Information
                        // -----------------------------------

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


                        // -----------------------------------
                        // Membership
                        // -----------------------------------

                        experience:
                            text(
                                body.experience
                            ),


                        reason:
                            text(
                                body.reason
                            ),


                        // -----------------------------------
                        // Division
                        // -----------------------------------

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


                        // -----------------------------------
                        // Resignation
                        // -----------------------------------

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


                        // -----------------------------------
                        // Rank Up
                        // -----------------------------------

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


                        // -----------------------------------
                        // Exam
                        // -----------------------------------

                        score:
                            body.score !== undefined &&
                            body.score !== null &&
                            text(body.score) !== ""
                                ? Number(body.score)
                                : null,


                        // -----------------------------------
                        // Status
                        // -----------------------------------

                        status:
                            "Pending",


                        // -----------------------------------
                        // Reply
                        // -----------------------------------

                        reply:
                            "در انتظار پاسخ فرماندهی",


                        // -----------------------------------
                        // Dates
                        // -----------------------------------

                        createdAt:
                            new Date(),

                        updatedAt:
                            new Date()

                    };


                    // ===================================
                    // INSERT
                    // ===================================

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


                    // ===================================
                    // RESPONSE
                    // ===================================

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
                        text(
                            req.body?.status
                        ) || "Pending";


                    const reply =
                        text(
                            req.body?.reply
                        );


                    const result =
                        await tickets.updateOne(

                            {
                                _id: id
                            },

                            {
                                $set: {

                                    status:
                                        status,

                                    reply:
                                        reply,

                                    updatedAt:
                                        new Date()

                                }

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
                            "تیکت با موفقیت بروزرسانی شد."

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
        // GET /tickets/:id/messages
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


                    // -----------------------------------
                    // Check Ticket
                    // -----------------------------------

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


                    // -----------------------------------
                    // Get Messages
                    // -----------------------------------

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
                        "GET /tickets/:id/messages Error:",
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
        // POST /tickets/:id/messages
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


                    // -----------------------------------
                    // Check Ticket
                    // -----------------------------------

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


                    // -----------------------------------
                    // Message
                    // -----------------------------------

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


                    // -----------------------------------
                    // Sender
                    // -----------------------------------

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


                    // -----------------------------------
                    // Command Info
                    // -----------------------------------

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


                    // -----------------------------------
                    // Create Message
                    // -----------------------------------

                    const newMessage = {

                        ticketId:
                            id.toString(),

                        sender:
                            sender,

                        message:
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


                    // -----------------------------------
                    // Insert
                    // -----------------------------------

                    const result =
                        await messagesCollection
                            .insertOne(
                                newMessage
                            );


                    console.log(
                        "💬 New Message:",
                        result.insertedId.toString(),
                        "| Ticket:",
                        id.toString(),
                        "| Sender:",
                        sender
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
                        "POST /tickets/:id/messages Error:",
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
        // DELETE /tickets/:id
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


                    // -----------------------------------
                    // Delete Ticket
                    // -----------------------------------

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


                    // -----------------------------------
                    // Delete Chat
                    // -----------------------------------

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
                        "DELETE /tickets/:id Error:",
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


// ===================================
// RUN
// ===================================

startServer();
