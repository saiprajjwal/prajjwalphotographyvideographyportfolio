/**
 * Optimizes Unsplash and Cloudinary image URLs for faster loading times.
 * @param {string} url - Original image URL
 * @param {number} width - Target width in pixels
 * @param {number} quality - Target quality (0-100)
 * @returns {string} Optimized image URL
 */
export function getOptimizedUrl(url, width = 800, quality = 70) {
  if (!url) return '';
  
  // Unsplash optimization
  if (url.includes('images.unsplash.com')) {
    let optimized = url;
    
    // Replace or append width
    if (optimized.includes('w=')) {
      optimized = optimized.replace(/w=\d+/, `w=${width}`);
    } else {
      optimized += `&w=${width}`;
    }
    
    // Replace or append quality
    if (optimized.includes('q=')) {
      optimized = optimized.replace(/q=\d+/, `q=${quality}`);
    } else {
      optimized += `&q=${quality}`;
    }
    
    // Ensure format is auto-optimized
    if (!optimized.includes('auto=format')) {
      optimized += '&auto=format';
    }
    
    return optimized;
  }
  
  // Cloudinary optimization
  if (url.includes('res.cloudinary.com')) {
    // Cloudinary format: https://res.cloudinary.com/cloud_name/image/upload/v12345/path/image.jpg
    if (url.includes('/upload/') && !url.includes('/raw/')) {
      // Check if transformations already exist
      // Standard upload format has /upload/ followed by version /v12345/ or folder name
      // If we don't find a comma, we can safely replace /upload/ with our optimizations
      const parts = url.split('/upload/');
      if (parts[1] && !parts[1].startsWith('w_') && !parts[1].includes(',')) {
        return url.replace('/upload/', `/upload/w_${width},c_limit,q_auto,f_auto/`);
      }
    }
  }
  
  return url;
}
