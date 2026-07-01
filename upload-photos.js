import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import portfolioData from './src/data/portfolio.json' with { type: 'json' };

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const SOURCE_DIR = path.resolve('photos-to-upload');
const VALID_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// A folder inside photos-to-upload/ is treated as a category if its name
// matches one of the categories defined in portfolio.json. Each upload is
// tagged with its category in Cloudinary — the site reads that tag live via
// /api/photos, so nothing needs to be written back to portfolio.json.
async function run() {
  const categories = portfolioData.categories.filter((c) => c !== 'All');
  let totalUploaded = 0;

  for (const category of categories) {
    const categoryDir = path.join(SOURCE_DIR, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
      continue;
    }

    const files = fs
      .readdirSync(categoryDir)
      .filter((file) => VALID_EXTENSIONS.has(path.extname(file).toLowerCase()));

    if (files.length === 0) continue;

    console.log(`\n${category}: uploading ${files.length} image(s)...`);

    const uploadedDir = path.join(categoryDir, 'uploaded');
    fs.mkdirSync(uploadedDir, { recursive: true });

    for (const file of files) {
      const filePath = path.join(categoryDir, file);
      try {
        await cloudinary.uploader.upload(filePath, {
          folder: 'portfolio',
          tags: category,
          context: `alt=${category} photo by Prajjwal Pandey`,
        });

        fs.renameSync(filePath, path.join(uploadedDir, file));
        console.log(`  ✓ ${file}`);
        totalUploaded += 1;
      } catch (error) {
        console.log(`  ✗ ${file} — failed: ${error.message}`);
      }
    }
  }

  if (totalUploaded === 0) {
    console.log(`No new images found. Drop files into a category folder under ${SOURCE_DIR}/`);
    console.log(`(${categories.join(', ')}) and run this again.`);
    return;
  }

  console.log(`\nUploaded ${totalUploaded} photo(s). They'll appear on the site within a few minutes`);
  console.log('(the /api/photos endpoint caches Cloudinary results for 5 minutes).');
}

run();
