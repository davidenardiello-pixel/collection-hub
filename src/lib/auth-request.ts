import type { NextRequest } from "next/server";
import { isAuthenticatedRequest, SESSION_COOKIE } from "./session";

export async function requireApiAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return isAuthenticatedRequest(token);
}
