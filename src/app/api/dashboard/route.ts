import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth-request";
import {
  loadDashboardFromStore,
  saveDashboardToStore,
} from "@/lib/dashboard-store";
import { normalizeDashboardData } from "@/lib/migrate";
import { formatStoreError } from "@/lib/store-errors";
import type { DashboardData } from "@/lib/types";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!(await requireApiAuth(request))) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  try {
    const result = await loadDashboardFromStore();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: formatStoreError(error) },
      { status: 500 },
    );
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
    return NextResponse.json(
      { error: formatStoreError(error) },
      { status: 500 },
    );
  }
}
