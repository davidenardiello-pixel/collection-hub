import { FISCAL_YEAR } from "./constants";
import { downloadTextFile } from "./download";
import { normalizeDashboardData } from "./migrate";
import type { DashboardData } from "./types";

export function createBackupFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `hsp-dashboard-backup-fy${FISCAL_YEAR}-${today}.json`;
}

export function serializeBackup(data: DashboardData): string {
  return JSON.stringify(data, null, 2);
}

export function parseBackup(raw: string): DashboardData | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DashboardData>;
    return normalizeDashboardData(parsed);
  } catch {
    return null;
  }
}

export function downloadBackup(data: DashboardData) {
  downloadTextFile(
    serializeBackup(data),
    createBackupFilename(),
    "application/json",
  );
}
