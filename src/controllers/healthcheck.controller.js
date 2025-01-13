import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asynchHandler.js";

const healthcheck = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, "Ok", "Health check pass"));
});

export { healthcheck };
