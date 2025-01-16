import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// all the common middlewares to be used
app.use(
  cors({
    orgin: process.env.CORS_ORIGIN,
    credential: true,
  })
);
app.use(express.json({ limit: "16kb" }));

app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

//import routes

import healthcheckrouter from "./routes/healthcheck.routes.js";

// routes

app.use("/api/v1/healthcheck", healthcheckrouter);

export { app };
