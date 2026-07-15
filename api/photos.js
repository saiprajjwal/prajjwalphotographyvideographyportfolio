import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  try {
    // Read via the Admin API, not the Search API. The Search API's context
    // index is only *eventually consistent* — after the admin reorders albums
    // or photos (which writes photo_order/album_order into context), the search
    // index can lag for minutes, so the live site kept showing stale/no order.
    // The Admin API reflects context writes immediately. (Cap: 500 resources.)
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'portfolio/',
      context: true,
      tags: true,
      max_results: 500,
    });

    const resources = (result.resources || []).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    const photos = resources.map((resource) => {
      const tags = resource.tags || [];
      const category = tags.find(t => !t.startsWith('session_') && !t.startsWith('cover_')) || 'Uncategorized';
      const sessionTag = tags.find(t => t.startsWith('session_'));
      const session = sessionTag ? sessionTag.replace(/^session_/, '').replace(/_/g, ' ') : null;
      const isCover = tags.some(t => t.startsWith('cover_'));

      const alt =
        resource.context?.custom?.alt ||
        resource.context?.alt ||
        `${category} photo by Prajjwal Pandey`;
        
      const cameraSettings =
        resource.context?.custom?.camera_settings ||
        resource.context?.camera_settings ||
        '';
         
      const photoOrder = parseInt(resource.context?.custom?.photo_order, 10) || 0;
      const albumOrder = parseInt(resource.context?.custom?.album_order, 10) || 0;

      return {
        id: resource.public_id,
        src: resource.secure_url.replace('/upload/', '/upload/f_auto,q_auto,w_1200,c_limit,dpr_auto/'),
        alt,
        category,
        session,
        isCover,
        photoOrder,
        albumOrder,
        cameraSettings,
      };
    });

    // Short edge cache: the Admin API is rate-limited (500/hr on the free
    // plan), so serving every visitor from origin is risky under traffic.
    // 30s at the edge caps origin hits while keeping admin edits near-live;
    // stale-while-revalidate serves instantly and refreshes in the background.
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    res.status(200).json({ photos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
