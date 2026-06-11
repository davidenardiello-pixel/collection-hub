import { NextResponse } from "next/server";
import { getDashboardPassword } from "@/lib/env";
import { createSessionToken, setSessionCookie } from "@/lib/session";

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
    await setSessionCookie(token);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Configurazione server incompleta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
