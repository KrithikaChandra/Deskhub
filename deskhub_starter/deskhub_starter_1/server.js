const express = require("express");
const jsonServer = require("json-server");
const path = require("path");

const app = express();
const port = process.env.PORT || 3001;

app.use(express.static(path.join(__dirname, "public")));
app.use("/src", express.static(path.join(__dirname, "src")));
app.use(jsonServer.router(path.join(__dirname, "src", "db.json")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
