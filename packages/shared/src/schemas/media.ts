import { z } from 'zod';
import { MEDIA_FOLDERS } from '../constants/limits';

export const mediaSignatureSchema = z.object({
  folder: z.enum(MEDIA_FOLDERS),
  /**
   * Optional incoming transformation applied by Cloudinary on upload, e.g. the crop
   * from react-easy-crop: "c_crop,x_10,y_20,w_800,h_1000". It is part of the signature,
   * so the client must send exactly the same string to Cloudinary.
   */
  transformation: z
    .string()
    .max(200)
    .regex(/^[a-z0-9_,.]+$/, 'Invalid transformation.')
    .optional(),
});
export type MediaSignatureInput = z.infer<typeof mediaSignatureSchema>;

/** What the client sends after a successful direct upload to Cloudinary. */
export const uploadedMediaSchema = z.object({
  type: z.enum(['IMAGE', 'VIDEO']),
  url: z.url(),
  publicId: z.string().min(1).max(255),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  duration: z.number().positive().nullable().optional(),
  thumbnailUrl: z.url().nullable().optional(),
});
export type UploadedMedia = z.infer<typeof uploadedMediaSchema>;
