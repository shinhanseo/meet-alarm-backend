import "dotenv/config";

import express, { Request, Response } from "express";
import placeSearchRouter from "./routes/placeSearch.js";
import directionSearchRounter from "./routes/directionSearch.js";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(express.json());

// health check
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/places", placeSearchRouter);
app.use("/api/direction", directionSearchRounter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
