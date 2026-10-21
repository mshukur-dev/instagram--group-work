import { v2 as cloudinary } from 'cloudinary';
import type { UploadedMedia } from '@instagram/shared';
import type { AppConfigService } from '../../config/app-config.service';
import { AppException } from '../../common/errors/app-exception';
import { MediaService } from './media.service';

type Keys = { name?: string; key?: string; secret?: string };

function makeService(keys: Keys): MediaService {
  const values: Record<string, string | undefined> = {
    CLOUDINARY_CLOUD_NAME: keys.name,
    CLOUDINARY_API_KEY: keys.key,
    CLOUDINARY_API_SECRET: keys.secret,
  };
  const config = {
    get: (k: string) => values[k],
    isCloudinaryEnabled: Boolean(keys.name && keys.key && keys.secret),
  } as unknown as AppConfigService;
  return new MediaService(config);
}

const media = (over: Partial<UploadedMedia> = {}): UploadedMedia => ({
  type: 'IMAGE',
  url: 'https://res.cloudinary.com/demo/image/upload/v1/instagram/posts/a.jpg',
  publicId: 'instagram/posts/a',
  width: 1080,
  height: 1080,
  ...over,
});

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return e instanceof AppException ? e.code : 'other';
  }
  return undefined;
};

describe('MediaService', () => {
  it('signs uploads into instagram/<folder>', () => {
    const service = makeService({ name: 'demo', key: '123', secret: 'shh' });
    const result = service.sign({ folder: 'posts', transformation: 'c_crop,w_10,h_10' });
    expect(result).toMatchObject({ apiKey: '123', cloudName: 'demo', folder: 'instagram/posts' });
    const expected = cloudinary.utils.api_sign_request(
      { timestamp: result.timestamp, folder: 'instagram/posts', transformation: 'c_crop,w_10,h_10' },
      'shh',
    );
    expect(result.signature).toBe(expected);
    expect(result.transformation).toBe('c_crop,w_10,h_10');
  });

  it('returns SERVICE_UNAVAILABLE without keys', () => {
    expect(codeOf(() => makeService({}).sign({ folder: 'posts' }))).toBe('SERVICE_UNAVAILABLE');
  });

  it('checks folder, cloud and video length of uploaded media', () => {
    const service = makeService({ name: 'demo', key: '1', secret: 's' });
    const rules = { folders: ['posts'] as const, maxVideoSeconds: 60 };
    expect(codeOf(() => service.assertUploaded([media()], rules))).toBeUndefined();
    expect(
      codeOf(() => service.assertUploaded([media({ publicId: 'instagram/stories/a' })], rules)),
    ).toBe('INVALID_MEDIA');
    expect(
      codeOf(() => service.assertUploaded([media({ url: 'https://evil.example/a.jpg' })], rules)),
    ).toBe('INVALID_MEDIA');
    expect(
      codeOf(() => service.assertUploaded([media({ type: 'VIDEO', duration: 61 })], rules)),
    ).toBe('INVALID_MEDIA');
  });

  it('accepts any URL without keys (dev / tests)', () => {
    const service = makeService({});
    const rules = { folders: ['posts'] as const, maxVideoSeconds: 60 };
    expect(
      codeOf(() => service.assertUploaded([media({ url: 'https://picsum.photos/1' })], rules)),
    ).toBeUndefined();
  });
});
