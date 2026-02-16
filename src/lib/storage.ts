import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'tarballs';
const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

export function tarballPath(formationId: string, version: string): string {
  return `formations/${formationId}/${version}.tar.gz`;
}

export async function uploadTarball(
  path: string,
  buffer: Buffer,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: 'application/gzip',
      upsert: false,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function createSignedDownloadUrl(
  path: string,
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }
  return data.signedUrl;
}

export async function deleteTarball(path: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
