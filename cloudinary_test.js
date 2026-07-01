import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

// 1. Configure Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function run() {
  try {
    // 2. Upload an image
    console.log("Uploading image...");
    const uploadResult = await cloudinary.uploader.upload("https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg", {
      public_id: "demo_sample_image"
    });
    
    console.log("Secure URL:", uploadResult.secure_url);
    console.log("Public ID:", uploadResult.public_id);

    // 3. Get image details
    console.log("\nFetching image details...");
    const details = await cloudinary.api.resource(uploadResult.public_id);
    console.log("Width:", details.width);
    console.log("Height:", details.height);
    console.log("Format:", details.format);
    console.log("Size in bytes:", details.bytes);

    // 4. Transform the image
    // f_auto: Automatically delivers the image in the most optimized format for the user's browser.
    // q_auto: Automatically adjusts the compression quality to reduce file size without visible loss.
    const transformedUrl = cloudinary.url(uploadResult.public_id, {
      fetch_format: 'auto',
      quality: 'auto'
    });

    console.log("\nDone! Click link below to see optimized version of the image. Check the size and the format.");
    console.log(transformedUrl);
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

run();
