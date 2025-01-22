import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file to Cloudinary
 * @param {string} localFilePath - The local path of the file to upload
 * @returns {Promise<Object>} - Returns the Cloudinary upload response
 */
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) {
      throw new Error("File path is missing");
    }

    // Upload the file to Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    console.log("File uploaded on Cloudinary. File Source: " + response.url);

    // Once the file is uploaded, delete it from the server
    fs.unlinkSync(localFilePath);

    return response; // Return the Cloudinary response
  } catch (error) {
    // Delete the file from the server even on error
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    console.error("Failed to upload to Cloudinary:", error.message);
    throw new Error("Failed to upload file to Cloudinary");
  }
};

const deletefromCloudinary = async (public_id) => {
  try {
    const result = await cloudinary.uploader.destroy(public_id);
    console.log("Deleted from cloudinary , Public_id:", public_id);
  } catch (error) {
    console.log("Error deleting from cloudinary", error);
    return null;
  }
};

export { uploadOnCloudinary, deletefromCloudinary };
