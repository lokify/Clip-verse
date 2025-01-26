import { asyncHandler } from "../utils/asynchHandler.js";
import ApiError from "../utils/Apierror.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deletefromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";

import fs from "fs";
import jwt from "jsonwebtoken";

const generateAcessandRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    //small check for user existence
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    const accessToken = user.getAccessTokens();
    const refreshToken = user.getRefreshTokens();
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens:", error);
    throw new ApiError(500, "Token generation failed");
  }
};
const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  if ([fullname, email, username, password].some((field) => !field?.trim())) {
    throw new ApiError(400, "All fields are required");
  }

  // Check if the user already exists
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existedUser)
    throw new ApiError(409, "User with the email or username already exists");

  const avatarLocalPath = req.files?.avatar?.[0]?.path || null;
  const coverLocalPath = req.files?.coverimage?.[0]?.path || null;

  if (!avatarLocalPath) {
    console.error("Avatar upload failed. Request files:", req.files);
    throw new ApiError(400, "Avatar is missing");
  }

  let avatar, coverimage;

  try {
    // Upload files to Cloudinary
    avatar = await uploadOnCloudinary(avatarLocalPath);
    coverimage = coverLocalPath
      ? await uploadOnCloudinary(coverLocalPath)
      : { url: "" };

    if (!avatar?.url) throw new ApiError(500, "Avatar upload failed");
    if (!coverimage?.url && coverLocalPath)
      throw new ApiError(500, "Cover image upload failed");

    // Create user in the database
    const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverimage: coverimage.url,
      email,
      password,
      username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new ApiError(
        500,
        "Something went wrong while registering the user"
      );
    }

    // Clean up temp files after successful upload
    [avatarLocalPath, coverLocalPath].forEach((path) => {
      if (path) {
        try {
          fs.unlinkSync(path);
          console.log(`Deleted temp file: ${path}`);
        } catch (error) {
          console.error(`Failed to delete temp file: ${path}`, error.message);
        }
      }
    });

    return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "User registered successfully"));
  } catch (error) {
    console.error("User creation failed:", error);

    // Cleanup Cloudinary files on error
    if (avatar?.public_id) {
      await deletefromCloudinary(avatar.public_id);
    }
    if (coverimage?.public_id) {
      await deletefromCloudinary(coverimage.public_id);
    }

    // Cleanup temp files on error
    [avatarLocalPath, coverLocalPath].forEach((path) => {
      if (path) {
        try {
          fs.unlinkSync(path);
          console.log(`Deleted temp file: ${path}`);
        } catch (error) {
          console.error(`Failed to delete temp file: ${path}`, error.message);
        }
      }
    });

    throw new ApiError(500, "User registration failed");
  }
});

const loginUser = asyncHandler(async (req, res) => {
  //get data from the body
  const { email, username, password } = req.body;

  //validation
  if (!email || !password) {
    throw new ApiError(400, "Please enter email and password");
  }

  const user = await User.findOne({ $or: [{ email }, { username }] });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  //validate password
  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAcessandRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: "" } },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized");
  }
  try {
    const decodedName = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedName?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (user?.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAcessandRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, newRefreshToken },
          " Token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old password and new password are required");
  }

  const user = await User.findById(req.user?._id);
  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res.status(200).json(new ApiResponse(200, {}, "Password updated"));
});
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user details"));
});
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;
  if (!fullname || !email) {
    throw new ApiError(400, "Fullname and email are required");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { fullname, email },
    { new: true }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated"));
});
const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.files?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is missing");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(500, "Avatar upload failed");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { avatar: avatar.url },
    { new: true }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.files?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image is missing");
  }
  const coverimage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverimage.url) {
    throw new ApiError(500, "Cover Image upload failed");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { coverimage: coverimage.url },
    { new: true }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image updated successfully"));
});
export {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
