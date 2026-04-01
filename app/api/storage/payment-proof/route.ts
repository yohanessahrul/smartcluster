import { NextResponse } from "next/server";

import { ensureBackendReady } from "@/lib/server/smart-api";
import { uploadPaymentProofToSupabase } from "@/lib/server/supabase";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(request: Request) {
  try {
    await ensureBackendReady();

    const formData = await request.formData();
    const billId = String(formData.get("billId") ?? "").trim();
    const fileValue = formData.get("file");
    const file = fileValue instanceof File ? fileValue : null;

    if (!billId) {
      return NextResponse.json({ message: "billId wajib diisi." }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ message: "File bukti pembayaran wajib diisi." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: "Ukuran file maksimal 5MB." }, { status: 400 });
    }
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ message: "Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF." }, { status: 400 });
    }

    const uploaded = await uploadPaymentProofToSupabase({ billId, file });
    return NextResponse.json(
      {
        status: true,
        billId,
        bucket: uploaded.bucket,
        path: uploaded.path,
        public_url: uploaded.publicUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: "Server error",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
