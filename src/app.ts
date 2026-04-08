import express from "express";
import ordenesProduccionRoutes from "./routes/ordenes-produccion.routes";

const app = express();

app.use(express.json());
app.use("/api", ordenesProduccionRoutes);

export default app;
