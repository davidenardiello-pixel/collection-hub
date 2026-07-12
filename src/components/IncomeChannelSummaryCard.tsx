"use client";

import { formatCurrency } from "@/lib/calculations";
import type { IncomeChannelSummary } from "@/lib/bank-accounts";
import { Card, DataRow, DataTable, Money } from "./ui";

export function IncomeChannelSummaryCard({
  summary,
  subtitle,
}: {
  summary: IncomeChannelSummary;
  subtitle?: string;
}) {
  const activeAccounts = summary.accounts.filter(
    (account) => account.gross > 0 || account.net > 0,
  );

  return (
    <Card
      title="Accrediti per conto e contanti"
      subtitle={
        subtitle ??
        "Netto in banca dopo commissioni OTA. La piattaforma Diretta è contanti."
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-rc-gold/20 bg-rc-charcoal/40 p-3">
          <p className="text-xs uppercase tracking-wide text-rc-muted">
            Totale in banca (netto)
          </p>
          <p className="mt-1 text-lg font-semibold text-emerald-400">
            {formatCurrency(summary.bankNet)}
          </p>
          <p className="mt-1 text-xs text-rc-muted">
            Lordo {formatCurrency(summary.bankGross)} · comm.{" "}
            {formatCurrency(summary.bankCommission)}
          </p>
        </div>
        <div className="rounded-lg border border-rc-gold/20 bg-rc-charcoal/40 p-3">
          <p className="text-xs uppercase tracking-wide text-rc-muted">
            Contanti (Diretta)
          </p>
          <p className="mt-1 text-lg font-semibold text-rc-gold-light">
            {formatCurrency(summary.cashTotal)}
          </p>
          <p className="mt-1 text-xs text-rc-muted">Non transitano in banca</p>
        </div>
        <div className="rounded-lg border border-rc-gold/20 bg-rc-charcoal/40 p-3 sm:col-span-2">
          <p className="text-xs uppercase tracking-wide text-rc-muted">
            Totale complessivo (netto + contanti)
          </p>
          <p className="mt-1 text-lg font-semibold text-rc-ink">
            {formatCurrency(summary.grandNet)}
          </p>
        </div>
      </div>

      <DataTable
        headers={["Conto", "Lordo", "Commissioni", "Netto in banca", "Dettaglio OTA"]}
      >
        {activeAccounts.map((account) => (
          <DataRow key={account.accountId}>
            <td className="px-2 py-2 font-semibold text-rc-gold-light">
              {account.label}
            </td>
            <td className="px-2 py-2">
              <Money value={account.gross} />
            </td>
            <td className="px-2 py-2">
              <Money value={account.commission} />
            </td>
            <td className="px-2 py-2 font-medium">
              <Money value={account.net} />
            </td>
            <td className="px-2 py-2 text-sm text-rc-muted">
              {account.platforms.length > 0
                ? account.platforms
                    .map(
                      (platform) =>
                        `${platform.name} ${formatCurrency(platform.net)}`,
                    )
                    .join(" · ")
                : "—"}
            </td>
          </DataRow>
        ))}
        <DataRow>
          <td className="px-2 py-2 font-semibold text-rc-gold-light">
            Totale banca
          </td>
          <td className="px-2 py-2 font-semibold">
            <Money value={summary.bankGross} />
          </td>
          <td className="px-2 py-2 font-semibold">
            <Money value={summary.bankCommission} />
          </td>
          <td className="px-2 py-2 font-semibold">
            <Money value={summary.bankNet} />
          </td>
          <td className="px-2 py-2 text-sm text-rc-muted">OTA e sito</td>
        </DataRow>
        {summary.cashTotal > 0 ? (
          <DataRow>
            <td className="px-2 py-2 font-semibold text-rc-gold-light">
              Contanti
            </td>
            <td className="px-2 py-2">
              <Money value={summary.cashTotal} />
            </td>
            <td className="px-2 py-2">—</td>
            <td className="px-2 py-2">
              <Money value={summary.cashTotal} />
            </td>
            <td className="px-2 py-2 text-sm text-rc-muted">Diretta</td>
          </DataRow>
        ) : null}
        <DataRow>
          <td className="px-2 py-2 font-semibold text-rc-ink">Totale generale</td>
          <td className="px-2 py-2 font-semibold">
            <Money value={summary.bankGross + summary.cashTotal} />
          </td>
          <td className="px-2 py-2 font-semibold">
            <Money value={summary.bankCommission} />
          </td>
          <td className="px-2 py-2 font-semibold">
            <Money value={summary.grandNet} />
          </td>
          <td className="px-2 py-2 text-sm text-rc-muted">Banca + contanti</td>
        </DataRow>
      </DataTable>
    </Card>
  );
}
