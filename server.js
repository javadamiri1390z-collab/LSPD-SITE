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

app.use(express.json());

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
// START SERVER
// ===================================

async function startServer() {

    try {

        await client.connect();

        console.log("MongoDB Connected ✅");


        const database =
            client.db("LSPD");


        tickets =
            database.collection("tickets");



        // ===================================
        // GET ALL TICKETS
        // ===================================

        app.get("/tickets", async (req, res) => {

            try {

                const data =
                    await tickets
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

                    message:
                        "خطا در دریافت درخواست‌ها"

                });

            }

        });



        // ===================================
        // CREATE NEW TICKET
        // ===================================

        app.post("/tickets", async (req, res) => {

            try {


                const ticket = {


                    // -------------------------
                    // OC NAME
                    // -------------------------

                    ocName:
                        String(
                            req.body.ocName || ""
                        ).trim(),



                    // -------------------------
                    // IC NAME
                    // -------------------------

                    icName:
                        String(
                            req.body.icName || ""
                        ).trim(),



                    // -------------------------
                    // OLD NAME
                    // برای سازگاری با سیستم قبلی
                    // -------------------------

                    name:
                        String(
                            req.body.icName ||
                            req.body.name ||
                            ""
                        ).trim(),



                    // -------------------------
                    // DISCORD
                    // -------------------------

                    discord:
                        String(
                            req.body.discord || ""
                        ).trim(),



                    // -------------------------
                    // STEAM HEX
                    // -------------------------

                    steamHex:
                        String(
                            req.body.steamHex || ""
                        ).trim(),



                    // -------------------------
                    // Phine number
                    // -------------------------

                    cmx:
                        String(
                            req.body.number || ""
                        ).trim(),



                    // -------------------------
                    // AGE
                    // -------------------------

                    age:
                        String(
                            req.body.age || ""
                        ).trim(),



                    // -------------------------
                    // EXPERIENCE
                    // -------------------------

                    experience:
                        String(
                            req.body.experience || ""
                        ).trim(),



                    // -------------------------
                    // REASON
                    // -------------------------

                    reason:
                        String(
                            req.body.reason || ""
                        ).trim(),



                    // -------------------------
                    // STATUS
                    // -------------------------

                    status: "Pending",



                    // -------------------------
                    // REPLY
                    // -------------------------

                    reply:
                        "در انتظار پاسخ فرماندهی",



                    // -------------------------
                    // DATE
                    // -------------------------

                    createdAt:
                        new Date()

                };



                const result =
                    await tickets.insertOne(ticket);



                console.log(
                    "New Ticket:",
                    result.insertedId.toString()
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
                    req.params.id;



                if (!ObjectId.isValid(id)) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "شناسه تیکت نامعتبر است"

                    });

                }



                const status =
                    String(
                        req.body.status || "Pending"
                    );


                const reply =
                    String(
                        req.body.reply || ""
                    );



                await tickets.updateOne(

                    {
                        _id:
                            new ObjectId(id)
                    },

                    {

                        $set: {

                            status: status,

                            reply: reply,

                            updatedAt:
                                new Date()

                        }

                    }

                );



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

        });



        // ===================================
        // DELETE TICKET
        // ===================================

        app.delete("/tickets/:id", async (req, res) => {

            try {


                const id =
                    req.params.id;



                if (!ObjectId.isValid(id)) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "شناسه تیکت نامعتبر است"

                    });

                }



                const result =
                    await tickets.deleteOne({

                        _id:
                            new ObjectId(id)

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


startServer();
