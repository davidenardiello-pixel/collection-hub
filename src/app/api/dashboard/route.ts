import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth-request";
import {
  loadDashboardFromStore,
  saveDashboardToStore,
} from "@/lib/dashboard-store";
import { normalizeDashboardData } from "@/lib/migrate";
import type { DashboardData } from "@/lib/types";

export async function GET(request: NextRequest) {
  if (!(await requireApiAuth(request))) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  try {
    const result = await loadDashboardFromStore();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore nel caricamento dati.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await requireApiAuth(request))) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<DashboardData>;
    const saved = await saveDashboardToStore(normalizeDashboardData(body));
    return NextResponse.json(saved);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore nel salvataggio dati.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
