import { NextResponse } from "next/server";

import { readSessionFromToken } from "@/lib/server/auth-session";
import { query } from "@/lib/server/db";
import { ensureBackendReady } from "@/lib/server/smart-api";
import { uploadPaymentProofToSupabase } from "@/lib/server/supabase";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const SESSION_COOKIE_NAME = "smart_perumahan_session";

type SessionRole = "admin" | "superadmin" | "finance" | "warga";

type SessionUserRow = {
  id: string;
  email: string;
  role: SessionRole;
};

function readCookieValue(headers: Headers, name: string) {
  const raw = headers.get("cookie");
  if (!raw) return null;
  const chunks = raw.split(";").map((item) => item.trim());
  for (const chunk of chunks) {
    if (!chunk) continue;
    const [key, ...rest] = chunk.split("=");
    if (key !== name) continue;
    const value = rest.join("=");
    if (!value) return "";
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    await ensureBackendReady();

    const token = readCookieValue(request.headers, SESSION_COOKIE_NAME);
    const session = readSessionFromToken(token);
    if (!session) {
      return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
    }

    const userResult = await query<SessionUserRow>(
      "SELECT id, email, role FROM users WHERE id=$1 AND LOWER(email)=$2 LIMIT 1",
      [session.userId, session.email.toLowerCase()],
    );
    const user = userResult.rows[0];
    if (!user) {
      return NextResponse.json({ message: "Sesi tidak valid." }, { status: 401 });
    }

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
    if (user.role === "warga") {
      const ownedBill = await query(
        `
          SELECT 1
          FROM bills b
          JOIN house_users hu ON hu.house_id = b.house_id
          WHERE b.id = $1
            AND LOWER(hu.user_email) = $2
          LIMIT 1
        `,
        [billId, user.email.toLowerCase()],
      );
      if (!ownedBill.rowCount) {
        return NextResponse.json({ message: "Warga hanya bisa upload bukti untuk tagihan rumahnya." }, { status: 403 });
      }
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
