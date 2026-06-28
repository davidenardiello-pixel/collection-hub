import { NextResponse } from "next/server";
import { getDashboardPassword } from "@/lib/env";
import { attachSessionCookie, createSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    const password = body.password?.trim();

    if (!password || password !== getDashboardPassword()) {
      return NextResponse.json(
        { error: "Password non corretta." },
        { status: 401 },
      );
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ ok: true });
    attachSessionCookie(response, token);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Configurazione server incompleta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
