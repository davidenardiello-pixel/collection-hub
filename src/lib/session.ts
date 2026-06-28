import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionSecret } from "./env";

export const SESSION_COOKIE = "rc_hub_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "team" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSessionSecret());
    return true;
  } catch {
    return false;
  }
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return response;
}

export function clearSessionCookieOnResponse(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function isAuthenticatedRequest(
  token: string | undefined,
): Promise<boolean> {
  if (!token) {
    return false;
  }
  return verifySessionToken(token);
}
