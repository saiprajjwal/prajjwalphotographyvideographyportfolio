import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const SOURCE_DIR = path.resolve('photos-to-upload');
const DATA_PATH = path.resolve('src/data/portfolio.json');
const VALID_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// A folder inside photos-to-upload/ is treated as a category if its name
// matches one of the categories already defined in portfolio.json (case-insensitive).
async function run() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const categories = data.categories.filter((c) => c !== 'All');

  const nextId = () =>
    String(1 + data.photos.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0));

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

    let countInCategory = data.photos.filter((p) => p.category === category).length;

    for (const file of files) {
      const filePath = path.join(categoryDir, file);
      try {
        const result = await cloudinary.uploader.upload(filePath, { folder: 'portfolio' });
        const optimizedUrl = result.secure_url.replace('/upload/', '/upload/f_auto,q_auto,w_1200,c_limit,dpr_auto/');

        countInCategory += 1;
        data.photos.push({
          id: nextId(),
          src: optimizedUrl,
          alt: `${category} photography by Prajjwal Pandey ${countInCategory}`,
          category,
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

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
  console.log(`\nUploaded ${totalUploaded} photo(s) and updated src/data/portfolio.json.`);
  console.log('Uploaded source files were moved into each category\'s "uploaded" subfolder.');
}

run();
