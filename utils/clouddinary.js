import sharp from 'sharp';
import {v2 as cloudinary} from "cloudinary";
 // Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});


const MAX_COMPRESSED_SIZE = 1 * 1024 * 1024;

export async function uploadImage(buffer, folder) {
  try {
    let finalBuffer = buffer;

    if (buffer.length > MAX_COMPRESSED_SIZE) {
      
      let quality = 90;
      let candidate = buffer;

      while (quality >= 40) {
        candidate = await sharp(buffer)
          .webp({ quality }) 
          .toBuffer();

        if (candidate.length <= MAX_COMPRESSED_SIZE) {
          break; 
        }

        quality -= 10; 
      }

      finalBuffer = candidate;
    }
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      uploadStream.end(finalBuffer);
    });
  } catch (error) {
    console.error('Error in image upload utility:', error);
    throw new Error('Image upload failed.');
  }
}