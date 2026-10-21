// Inserts a Cloudinary transformation into the URL, e.g. "c_fill,w_150,h_150,f_auto,q_auto".
// Non-Cloudinary URLs (seed placeholders) are returned unchanged.
export function cldUrl(url: string, transformation: string): string {
  if (!url.includes('res.cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/${transformation}/`);
}
