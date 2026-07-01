import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  try {
    const result = await cloudinary.search
      .expression('folder:portfolio')
      .with_field('context')
      .with_field('tags')
      .sort_by('created_at', 'desc')
      .max_results(200)
      .execute();

    const photos = result.resources.map((resource) => {
      const category = (resource.tags && resource.tags[0]) || 'Uncategorized';
      const alt =
        resource.context?.custom?.alt ||
        resource.context?.alt ||
        `${category} photo by Prajjwal Pandey`;

      return {
        id: resource.public_id,
        src: resource.secure_url.replace('/upload/', '/upload/f_auto,q_auto,w_1200,c_limit,dpr_auto/'),
        alt,
        category,
      };
    });

    // Short edge cache only — long enough to absorb bursts of page loads,
    // short enough that a fresh upload shows up on the site almost immediately.
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    res.status(200).json({ photos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
