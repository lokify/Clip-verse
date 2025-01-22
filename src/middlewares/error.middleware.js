import mongoose from "mongoose";
import ApiError from "../utils/Apierror.js";

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Ensure `error` is an instance of `ApiError`
  if (!(error instanceof ApiError)) {
    const isMongooseError =
      typeof mongoose.Error === "function" && error instanceof mongoose.Error;
    const statusCode = isMongooseError ? 400 : 500; // Fallback to 400 for Mongoose errors, otherwise 500
    const message = error.message || "Something went wrong";
    error = new ApiError(statusCode, message, error?.errors || [], err.stack);
  }

  // Prepare response
  const response = {
    statusCode: error.statusCode || 500, // Ensure statusCode is defined
    message: error.message,
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  // Send response with the status code
  return res.status(error.statusCode || 500).json(response);
};

export { errorHandler };
