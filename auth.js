app.post("/auth/login", async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: "نام کاربری و رمز عبور الزامی است."
        });
    }

    // احراز هویت از Environment Variables
    if (
        username === process.env.ADMIN_USERNAME &&
        password === process.env.ADMIN_PASSWORD
    ) {
        return res.json({
            success: true,
            role: "admin",
            username,
            rank: "Command"
        });
    }

    if (
        username === process.env.COMMAND_USERNAME &&
        password === process.env.COMMAND_PASSWORD
    ) {
        return res.json({
            success: true,
            role: "command",
            username,
            rank: "Command"
        });
    }

    return res.status(401).json({
        success: false,
        message: "نام کاربری یا رمز عبور اشتباه است."
    });
});
