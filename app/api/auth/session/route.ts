import { NextRequest, NextResponse } from "next/server";

import { applySessionCookie, clearSessionCookie, createSessionToken, readSessionFromRequest } from "@/lib/server/auth-session";
import { query } from "@/lib/server/db";

type SessionUserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "superadmin" | "warga" | "finance";
};

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = readSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
    }

    const result = await query<SessionUserRow>(
      "SELECT id, name, email, role FROM users WHERE id = $1 AND LOWER(email) = $2 LIMIT 1",
      [session.userId, session.email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) {
      const unauthorized = NextResponse.json({ message: "Sesi tidak valid." }, { status: 401 });
      clearSessionCookie(unauthorized);
      return unauthorized;
    }

    const nextToken = createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    const response = NextResponse.json({
      session: {
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
    applySessionCookie(response, nextToken);
    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Server error saat mengambil sesi." },
      { status: 500 }
    );
  }
}
