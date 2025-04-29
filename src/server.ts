import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import recipeRoutes from './routes/recipeRoutes';
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import http from 'http';
import { setupWebSocket } from "./config/wsServer";
import userRoutes from './routes/userRoutes';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Swagger
const swaggerDocument = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config', 'swagger.json'), 'utf-8')
);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/api/recipes', recipeRoutes);
app.use('/api/users', userRoutes);

// Root
app.get("/", (req, res) => {
  res.send("✅ Backend Recipe Generator funcționează!");
});

// WebSocket
setupWebSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 HTTP + WS server rulează pe http://localhost:${PORT}`);
});
