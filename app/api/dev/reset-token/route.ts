import { NextRequest, NextResponse } from "next/server";

import { clearResetTokenByEmail, getResetTokenByEmail } from "@/lib/reset-token-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ message: "Email wajib diisi." }, { status: 400 });
  }

  const token = getResetTokenByEmail(email);
  if (!token) {
    return NextResponse.json({ message: "Token reset belum tersedia untuk email ini." }, { status: 404 });
  }

  return NextResponse.json({ token });
}

export async function DELETE(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ message: "Email wajib diisi." }, { status: 400 });
  }

  clearResetTokenByEmail(email);
  return NextResponse.json({ status: true });
}
