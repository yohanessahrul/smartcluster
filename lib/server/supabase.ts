import { createClient } from "@supabase/supabase-js";

type GlobalSupabaseState = typeof globalThis & {
  smartPerumahanSupabaseAdminClient?: ReturnType<typeof createClient>;
  smartPerumahanSupabaseBucketReady?: boolean;
};

const globalSupabaseState = globalThis as GlobalSupabaseState;

function deriveSupabaseUrlFromProjectRef(projectRef: string | null | undefined) {
  const ref = projectRef?.trim().toLowerCase();
  if (!ref) return null;
  if (!/^[a-z0-9-]+$/.test(ref)) return null;
  return `https://${ref}.supabase.co`;
}

function deriveSupabaseUrlFromDatabaseUrl(connectionString: string | undefined) {
  if (!connectionString) return null;
  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname.toLowerCase();
    const match = /^db\.([a-z0-9-]+)\.supabase\.co$/.exec(host);
    if (!match) return null;
    return `https://${match[1]}.supabase.co`;
  } catch {
    return null;
  }
}

function deriveProjectRefFromSupabaseJwt(token: string | undefined) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as { ref?: unknown };
    if (typeof payload.ref !== "string") return null;
    const ref = payload.ref.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(ref)) return null;
    return ref;
  } catch {
    return null;
  }
}

function getSupabaseUrl() {
  const projectRef =
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF?.trim() ||
    deriveProjectRefFromSupabaseJwt(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    deriveProjectRefFromSupabaseJwt(process.env.SUPABASE_SERVICE_ROLE) ||
    deriveProjectRefFromSupabaseJwt(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY);

  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    deriveSupabaseUrlFromProjectRef(projectRef) ||
    deriveSupabaseUrlFromDatabaseUrl(process.env.SUPABASE_DB_URL) ||
    deriveSupabaseUrlFromDatabaseUrl(process.env.DATABASE_URL) ||
    deriveSupabaseUrlFromDatabaseUrl(process.env.POSTGRES_URL) ||
    deriveSupabaseUrlFromDatabaseUrl(process.env.POSTGRES_PRISMA_URL) ||
    deriveSupabaseUrlFromDatabaseUrl(process.env.POSTGRES_URL_NON_POOLING);
  if (!url) {
    throw new Error(
      "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL belum diset. Set salah satu URL Supabase atau SUPABASE_PROJECT_REF/SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return url;
}

function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE?.trim();
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

function extractPublicObjectPath(publicUrl: string, bucket: string) {
  try {
    const parsed = new URL(publicUrl);
    const directPrefix = `/storage/v1/object/public/${bucket}/`;
    if (parsed.pathname.startsWith(directPrefix)) {
      return decodeURIComponent(parsed.pathname.slice(directPrefix.length));
    }
    const encodedPrefix = `/storage/v1/object/public/${encodeURIComponent(bucket)}/`;
    if (parsed.pathname.startsWith(encodedPrefix)) {
      return decodeURIComponent(parsed.pathname.slice(encodedPrefix.length));
    }
    return null;
  } catch {
    return null;
  }
}

export async function deletePaymentProofFromSupabase(publicUrl: string | null | undefined) {
  const normalizedUrl = typeof publicUrl === "string" ? publicUrl.trim() : "";
  if (!normalizedUrl) return { deleted: false as const, reason: "empty-url" };

  const bucket = getSupabaseStorageBucket();
  const objectPath = extractPublicObjectPath(normalizedUrl, bucket);
  if (!objectPath) return { deleted: false as const, reason: "invalid-public-url" };

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (error) {
    const message = (error.message || "").toLowerCase();
    if (message.includes("not found") || message.includes("not exist")) {
      return { deleted: false as const, reason: "not-found" };
    }
    throw new Error(`Gagal hapus bukti pembayaran di storage: ${error.message}`);
  }

  return { deleted: true as const, reason: "ok" };
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
