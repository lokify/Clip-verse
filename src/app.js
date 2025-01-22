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

import userRouter from "./routes/user.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

// routes

app.use("/api/v1/healthcheck", healthcheckrouter);
app.use("/api/v1/user", userRouter);
app.use(errorHandler);

export { app };
