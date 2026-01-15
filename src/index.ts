import "dotenv/config";

import express, { Request, Response } from "express";
import placeSearchRouter from "./routes/placeSearch.js";
import directionSearchRouter from "./routes/directionSearch.js";
import weatherSearchRouter from "./routes/weatherSearch.js";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health check
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/places", placeSearchRouter);
app.use("/api/direction", directionSearchRouter);
app.use("/api/weather", weatherSearchRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

