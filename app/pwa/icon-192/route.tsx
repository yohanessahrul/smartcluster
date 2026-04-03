import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/brand/icon-192-green.png", request.url), 307);
}
