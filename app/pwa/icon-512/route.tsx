import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/brand/icon-512.png", request.url), 307);
}
