// ===================================
// Vanguard LSPD System
// MongoDB Ticket Server
// ===================================

const express = require("express");
const cors = require("cors");
const path = require("path");
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
    res.sendFile(path.join(__dirname, "index.html"));
});


// ===================================
// MONGODB
// ===================================

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
    console.error(
        "❌ MONGODB_URI در Environment Variables تنظیم نشده است."
    );

    process.exit(1);
}

const client = new MongoClient(MONGO_URI);

let tickets;


// ===================================
// HELPERS
// ===================================

function text(value) {
    return String(value ?? "").trim();
}

function safeObjectId(id) {
    return ObjectId.isValid(id)
        ? new ObjectId(id)
        : null;
}


// ===================================
// START SERVER
// ===================================

async function startServer() {

    try {

        await client.connect();

        console.log("MongoDB Connected ✅");

        const database = client.db("LSPD");

        tickets = database.collection("tickets");


        // ===================================
        // GET ALL TICKETS
        // ===================================

        app.get("/tickets", async (req, res) => {

            try {

                const data = await tickets
                    .find({})
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json(data);

            } catch (error) {

                console.error(
                    "GET /tickets Error:",
                    error
                );

                res.status(500).json({
                    success: false,
                    message: "خطا در دریافت درخواست‌ها"
                });

            }

        });


        // ===================================
        // GET SINGLE TICKET
        // ===================================

        app.get("/tickets/:id", async (req, res) => {

            try {

                const id =
                    safeObjectId(req.params.id);

                if (!id) {

                    return res.status(400).json({
                        success: false,
                        message: "کد پیگیری نامعتبر است."
                    });

                }

                const ticket =
                    await tickets.findOne({
                        _id: id
                    });

                if (!ticket) {

                    return res.status(404).json({
                        success: false,
                        message: "درخواست پیدا نشد."
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
                    message: "خطا در دریافت درخواست"
                });

            }

        });


        // ===================================
        // CREATE NEW TICKET
        // ===================================

        app.post("/tickets", async (req, res) => {

            try {

                const body = req.body || {};

                /*
                    requestType:

                    membership
                    division
                    resignation
                    rankup
                */

                const requestType =
                    text(
                        body.requestType ||
                        body.type ||
                        "membership"
                    );


                const score =
                    Number.isFinite(Number(body.score))
                        ? Number(body.score)
                        : null;


                const passed =
                    body.passed === true;


                const ticket = {

                    // ===================================
                    // نوع درخواست
                    // ===================================

                    requestType: requestType,


                    // ===================================
                    // اطلاعات مشترک
                    // ===================================

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


                    // ===================================
                    // درخواست عضویت
                    // ===================================

                    experience:
                        text(body.experience),

                    reason:
                        text(body.reason),


                    // ===================================
                    // آزمون استخدام
                    // ===================================

                    score: score,

                    passed: passed,


                    // ===================================
                    // درخواست دیویژن
                    // ===================================

                    currentDivision:
                        text(body.currentDivision),

                    requestedDivision:
                        text(body.requestedDivision),

                    reasonForRequest:
                        text(body.reasonForRequest),

                    previousDivisionExperience:
                        text(
                            body.previousDivisionExperience
                        ),

                    additionalInformation:
                        text(
                            body.additionalInformation
                        ),


                    // ===================================
                    // درخواست استعفا
                    // ===================================

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


                    // ===================================
                    // درخواست Rank Up
                    // ===================================

                    requestRank:
                        text(body.requestRank),

                    currentRankTimeplay:
                        text(
                            body.currentRankTimeplay
                        ),

                    note:
                        text(body.note),


                    // ===================================
                    // وضعیت
                    // ===================================

                    status:
                        "Pending",


                    // ===================================
                    // پاسخ فرماندهی
                    // ===================================

                    reply:
                        "در انتظار پاسخ فرماندهی",


                    // ===================================
                    // CHAT
                    // ===================================

                    messages: [],


                    // ===================================
                    // تاریخ
                    // ===================================

                    createdAt:
                        new Date()

                };


                const result =
                    await tickets.insertOne(ticket);


                console.log(
                    "New Ticket:",
                    result.insertedId.toString(),
                    "| Type:",
                    requestType
                );


                res.json({

                    success: true,

                    id:
                        result.insertedId.toString()

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

        });


        // ===================================
        // UPDATE TICKET
        // ===================================

        app.put("/tickets/:id", async (req, res) => {

            try {

                const id =
                    safeObjectId(req.params.id);


                if (!id) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "شناسه تیکت نامعتبر است"

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

                                status:
                                    status,

                                reply:
                                    reply,

                                updatedAt:
                                    new Date()

                            }

                        }

                    );


                res.json({

                    success:
                        result.matchedCount > 0

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

        });


        // ===================================
        // GET CHAT MESSAGES
        // ===================================

        app.get(
            "/tickets/:id/messages",
            async (req, res) => {

                try {

                    const id =
                        safeObjectId(req.params.id);


                    if (!id) {

                        return res.status(400).json({

                            success: false,

                            message:
                                "شناسه تیکت نامعتبر است"

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


        // ===================================
        // SEND CHAT MESSAGE
        // ===================================

        app.post(
            "/tickets/:id/messages",
            async (req, res) => {

                try {

                    const id =
                        safeObjectId(req.params.id);


                    if (!id) {

                        return res.status(400).json({

                            success: false,

                            message:
                                "شناسه تیکت نامعتبر است"

                        });

                    }


                    const message =
                        text(req.body.message);


                    let sender =
                        text(req.body.sender);


                    if (
                        sender !== "command" &&
                        sender !== "applicant"
                    ) {

                        sender = "applicant";

                    }


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


                    const chatMessage = {

                        sender:
                            sender,

                        message:
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


                    if (
                        result.matchedCount === 0
                    ) {

                        return res.status(404).json({

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


        // ===================================
        // DELETE TICKET
        // ===================================

        app.delete("/tickets/:id", async (req, res) => {

            try {

                const id =
                    safeObjectId(req.params.id);


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


                res.json({

                    success:
                        result.deletedCount > 0

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

        });


        // ===================================
        // SERVER
        // ===================================

        const PORT =
            process.env.PORT || 3000;


        app.listen(PORT, () => {

            console.log(
                `🚔 Vanguard LSPD Server running on port ${PORT}`
            );

        });


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
