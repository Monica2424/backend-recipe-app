import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import recipeRoutes from './routes/recipeRoutes';
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Servește fișierul Swagger JSON
const swaggerDocument = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config', 'swagger.json'), 'utf-8')
);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API routes
app.use('/api/recipes', recipeRoutes);

// Home route
app.get("/", (req, res) => {
  res.send("✅ Backend Recipe Generator funcționează!");
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Serverul rulează pe http://localhost:${PORT}`);
  console.log(`📚 Documentația API: http://localhost:${PORT}/api-docs`);
});
