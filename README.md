# Photography & Filmmaking Portfolio

A dark, cinematic, and minimal portfolio website built with React, Vite, and plain CSS.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Run the development server:**
   ```bash
   npm run dev
   ```

## Customizing Content

All of the content (photos, videos, about me details) is driven by a single JSON file to make updates easy without touching the components.

### Editing `src/data/portfolio.json`

Open `src/data/portfolio.json` to update your portfolio:

- **Categories**: Update the `"categories"` array to change the filter options on the Portfolio page. (Make sure `"All"` is the first item).
- **Photos**: Add objects to the `"photos"` array.
  - `id`: Unique identifier (string).
  - `src`: The URL path to your image (can be a local path like `/assets/photo.jpg` or a Cloudinary/Unsplash URL).
  - `alt`: Descriptive text for accessibility.
  - `category`: Must match one of your categories.
- **Videos**: Add objects to the `"videos"` array.
  - `id`: The YouTube video ID (e.g., `dQw4w9WgXcQ` from `youtube.com/watch?v=dQw4w9WgXcQ`).
  - `title`: The title of the video.
- **About**: Update your name, tagline, bio, gear list, email, and social links in the `"about"` object.

## Cloudinary Integration (Optional)

If you have a Cloudinary account, you can use the included `cloudinary_test.js` script to verify your credentials and upload a test image.
Make sure you have installed the SDK: `npm install cloudinary` and run `node cloudinary_test.js`.
