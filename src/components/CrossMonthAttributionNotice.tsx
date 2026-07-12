"use client";

import { MONTH_LABELS } from "@/lib/constants";
import type { CrossMonthAttribution } from "@/lib/ota-import/cross-month-attribution";
import { formatAttributionMonth } from "@/lib/ota-import/cross-month-attribution";

export function CrossMonthAttributionNotice({
  importPeriod,
  attributions,
}: {
  importPeriod: { year: number; month: number };
  attributions: CrossMonthAttribution[];
}) {
  if (attributions.length === 0) {
    return null;
  }

  const importLabel = `${MONTH_LABELS[importPeriod.month - 1]} ${importPeriod.year}`;

  return (
    <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-950/25 px-4 py-3 text-sm text-amber-50">
      <p className="font-semibold text-amber-200">
        {attributions.length} prenotazion
        {attributions.length === 1 ? "e" : "i"} con check-in fuori da {importLabel}
      </p>
      <p className="mt-2 text-amber-100/90">
        Importate dal file di {importLabel}, ma conteggiate negli incassi del mese di
        check-in.
      </p>
      <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-amber-100/80">
        {attributions.map((item) => (
          <li key={item.externalId}>
            <strong className="text-amber-100">{item.guestName}</strong> · check-in{" "}
            {item.checkIn} → {item.checkOut} · incasso in{" "}
            <strong className="text-amber-200">
              {formatAttributionMonth(item.attributionPeriod)}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
