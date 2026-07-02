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
      const tags = resource.tags || [];
      const category = tags.find(t => !t.startsWith('session_')) || 'Uncategorized';
      const sessionTag = tags.find(t => t.startsWith('session_'));
      const session = sessionTag ? sessionTag.replace(/^session_/, '').replace(/_/g, ' ') : null;

      const alt =
        resource.context?.custom?.alt ||
        resource.context?.alt ||
        `${category} photo by Prajjwal Pandey`;

      return {
        id: resource.public_id,
        src: resource.secure_url.replace('/upload/', '/upload/f_auto,q_auto,w_1200,c_limit,dpr_auto/'),
        alt,
        category,
        session,
      };
    });

    // No caching: for a personal portfolio's traffic level, Cloudinary's
    // Search API quota isn't a real concern, but a stale photo list after
    // uploading directly undermines the point of a live admin panel.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ photos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
