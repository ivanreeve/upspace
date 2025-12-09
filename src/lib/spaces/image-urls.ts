import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const SUPABASE_DEFAULT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_BASE_URL = SUPABASE_DEFAULT_URL.replace(/\/+$/, '');
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export const isAbsoluteUrl = (value: string | null | undefined): value is string =>
  Boolean(value && /^https?:\/\//i.test(value));

export const buildPublicObjectUrl = (path: string | null | undefined) => {
  if (!path) {
    return null;
  }
  if (isAbsoluteUrl(path)) {
    return path;
  }
  const safePath = path as string;
  const normalized = safePath.replace(/^\/+/u, '');
  if (!SUPABASE_BASE_URL) {
    return null;
  }
  return `${SUPABASE_BASE_URL}/storage/v1/object/public/${normalized}`;
};

type StoragePathParts = {
  bucket: string;
  objectPath: string;
  fullPath: string;
};

const parseStoragePath = (path: string | null | undefined): StoragePathParts | null => {
  if (!path || isAbsoluteUrl(path)) {
    return null;
  }

  const safePath = path as string;
  const normalized = safePath.replace(/^\/+/u, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const [bucket, ...objectParts] = segments;
  if (!bucket || objectParts.length === 0) {
    return null;
  }

  return {
    bucket,
    objectPath: objectParts.join('/'),
    fullPath: path,
  };
};

export async function resolveSignedImageUrls(
  images: { path: string | null | undefined }[]
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  if (!images.length) {
    return urlMap;
  }

  const candidates = images
    .map((image) => parseStoragePath(image.path))
    .filter((value): value is StoragePathParts => Boolean(value));

  if (!candidates.length) {
    return urlMap;
  }

  let adminClient;
  try {
    adminClient = getSupabaseAdminClient();
  } catch (error) {
    console.error('Failed to initialize Supabase admin client for signed URLs.', error);
    return urlMap;
  }

  const bucketGroups = candidates.reduce((group, entry) => {
    const existing = group.get(entry.bucket) ?? [];
    existing.push(entry);
    group.set(entry.bucket, existing);
    return group;
  }, new Map<string, StoragePathParts[]>());

  for (const [bucket, entries] of bucketGroups) {
    try {
      const {
 data, error, 
} = await adminClient.storage.from(bucket).createSignedUrls(
        entries.map((entry) => entry.objectPath),
        SIGNED_URL_TTL_SECONDS
      );

      if (error || !data) {
        console.error(`Failed to create signed URLs for bucket ${bucket}.`, error);
        continue;
      }

      data.forEach((result, index) => {
        if (!result || result.error || !result.signedUrl) {
          return;
        }
        const source = entries[index];
        if (source) {
          urlMap.set(source.fullPath, result.signedUrl);
        }
      });
    } catch (error) {
      console.error(`Unable to create signed URLs for bucket ${bucket}.`, error);
    }
  }

  return urlMap;
}

export const resolveImageUrl = (
  path: string | null | undefined,
  signedUrlMap?: Map<string, string>
) => {
  if (!path) {
    return null;
  }
  if (isAbsoluteUrl(path)) {
    return path;
  }
  const safePath = path as string;
  const normalized = safePath.replace(/^\/+/u, '');
  return signedUrlMap?.get(path) ?? signedUrlMap?.get(normalized) ?? buildPublicObjectUrl(normalized);
};
