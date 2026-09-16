import { v2 as cloudinary } from 'cloudinary';

// Only installed by isolated test runners; never used by the application.
export function installCloudinaryFake() {
  const files = new Map<string, string>();
  process.env.CLOUDINARY_CLOUD_NAME = 'test-only';
  process.env.CLOUDINARY_API_KEY = 'test-only';
  process.env.CLOUDINARY_API_SECRET = 'test-only';
  const upload = cloudinary.uploader.upload;
  const destroy = cloudinary.uploader.destroy;
  const download = cloudinary.utils.private_download_url;
  cloudinary.uploader.upload = (async (
    data: string,
    options: { public_id: string; type: string },
  ) => {
    if (options.type !== 'authenticated') throw new Error('KTP must be authenticated');
    files.set(options.public_id, data);
    return { public_id: options.public_id };
  }) as typeof upload;
  cloudinary.uploader.destroy = (async (id: string) => ({
    result: files.delete(id) ? 'ok' : 'not found',
  })) as typeof destroy;
  cloudinary.utils.private_download_url = (id) => {
    const data = files.get(id);
    if (!data) throw new Error('Missing test asset');
    return data;
  };
  return () => {
    cloudinary.uploader.upload = upload;
    cloudinary.uploader.destroy = destroy;
    cloudinary.utils.private_download_url = download;
    files.clear();
  };
}
