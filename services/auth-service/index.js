const express = require("express");

const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`Auth service running on port ${PORT}`);
});