import { createClient } from "@supabase/supabase-js";

type GlobalSupabaseState = typeof globalThis & {
  smartPerumahanSupabaseAdminClient?: ReturnType<typeof createClient>;
  smartPerumahanSupabaseBucketReady?: boolean;
};

const globalSupabaseState = globalThis as GlobalSupabaseState;

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum diset.");
  return url;
}

function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diset.");
  return key;
}

export function getSupabaseStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || "payment-proofs";
}

export function getSupabaseAdminClient() {
  if (!globalSupabaseState.smartPerumahanSupabaseAdminClient) {
    globalSupabaseState.smartPerumahanSupabaseAdminClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return globalSupabaseState.smartPerumahanSupabaseAdminClient;
}

export async function uploadPaymentProofToSupabase(params: { billId: string; file: File }) {
  const { billId, file } = params;
  const supabase = getSupabaseAdminClient();
  const bucket = getSupabaseStorageBucket();
  if (!globalSupabaseState.smartPerumahanSupabaseBucketReady) {
    const { data: existingBucket } = await supabase.storage.getBucket(bucket);
    if (!existingBucket) {
      const { error: createBucketError } = await supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: `${5 * 1024 * 1024}`,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
      });
      if (createBucketError) {
        throw new Error(`Gagal menyiapkan bucket Supabase Storage: ${createBucketError.message}`);
      }
    }
    globalSupabaseState.smartPerumahanSupabaseBucketReady = true;
  }

  const originalName = file.name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const path = `bills/${billId}/${timestamp}-${originalName || "proof"}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    cacheControl: "3600",
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) {
    throw new Error(`Gagal upload bukti pembayaran: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    bucket,
    path,
    publicUrl: data.publicUrl,
  };
}
