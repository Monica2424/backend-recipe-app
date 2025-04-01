import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ Backend Recipe Generator funcționează!");
});

app.listen(PORT, () => {
  console.log(`🚀 Serverul rulează pe http://localhost:${PORT}`);
});
