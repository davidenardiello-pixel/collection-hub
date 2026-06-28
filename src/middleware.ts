import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isCloudModeConfigured } from "@/lib/env";
import { isAuthenticatedRequest, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/config"];

export async function middleware(request: NextRequest) {
  if (!isCloudModeConfigured()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isAuthenticated = await isAuthenticatedRequest(token);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (pathname.startsWith("/api/")) {
    if (isPublic || isAuthenticated) {
      return NextResponse.next();
    }

    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  if (!isAuthenticated && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
