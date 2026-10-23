// Inserts a Cloudinary transformation into the URL, e.g. "c_fill,w_150,h_150,f_auto,q_auto".
// Non-Cloudinary URLs (seed placeholders) are returned unchanged.
export function cldUrl(url: string, transformation: string): string {
  if (!url.includes('res.cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/${transformation}/`);
}

// A still frame of a Cloudinary video as an image (first frame, as JPEG). Null for other URLs.
export function videoPoster(
  url: string,
  transformation = 'so_0,w_480,f_auto,q_auto',
): string | null {
  if (!url.includes('res.cloudinary.com')) return null;
  return cldUrl(url, transformation).replace(/\.[a-z0-9]+(\?.*)?$/i, '.jpg');
}
