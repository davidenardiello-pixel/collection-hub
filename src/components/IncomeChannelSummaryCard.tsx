"use client";

import { formatCurrency } from "@/lib/calculations";
import type { IncomeChannelSummary } from "@/lib/bank-accounts";
import { Card, DataRow, DataTable, Money } from "./ui";

function formatDetailItems(items: { name: string; net: number }[]): string {
  if (items.length === 0) {
    return "—";
  }

  return items
    .map((item) => `${item.name} ${formatCurrency(item.net)}`)
    .join(" · ");
}

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
  const activeProperties = summary.properties.filter(
    (property) => property.totalNet > 0 || property.gross > 0,
  );
  const activePlatforms = summary.platforms.filter(
    (platform) => platform.totalNet > 0 || platform.gross > 0,
  );
  const totalPropertyGross = activeProperties.reduce(
    (total, property) => total + property.gross,
    0,
  );
  const totalPlatformGross = activePlatforms.reduce(
    (total, platform) => total + platform.gross,
    0,
  );

  return (
    <Card
      title="Accrediti per conto e contanti"
        subtitle={
          subtitle ??
          "Netto in banca dopo commissioni OTA. Incassi OTA: mese di check-in (allineato agli sheet)."
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
        headers={[
          "Conto",
          "Lordo",
          "Commissioni",
          "Netto in banca",
          "Dettaglio OTA",
          "Dettaglio appartamenti",
        ]}
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
            <td className="px-2 py-2 text-sm text-rc-muted">
              {formatDetailItems(account.properties)}
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
          <td className="px-2 py-2 text-sm text-rc-muted">
            {formatDetailItems(
              activePlatforms.map((platform) => ({
                name: platform.name,
                net: platform.bankNet,
              })),
            )}
          </td>
          <td className="px-2 py-2 text-sm text-rc-muted">
            {formatDetailItems(
              activeProperties.map((property) => ({
                name: property.name,
                net: property.bankNet,
              })),
            )}
          </td>
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
            <td className="px-2 py-2 text-sm text-rc-muted">
              {formatDetailItems(
                activeProperties
                  .filter((property) => property.cash > 0)
                  .map((property) => ({
                    name: property.name,
                    net: property.cash,
                  })),
              )}
            </td>
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
          <td className="px-2 py-2 text-sm text-rc-muted">
            {formatDetailItems(
              activeProperties.map((property) => ({
                name: property.name,
                net: property.totalNet,
              })),
            )}
          </td>
        </DataRow>
      </DataTable>

      {activePlatforms.length > 0 ? (
        <div className="mt-8">
          <p className="mb-3 text-sm font-medium text-rc-gold-light">
            Suddivisione per OTA (piattaforma)
          </p>
          <p className="mb-4 text-sm text-rc-muted">
            Incassi per canale dopo commissioni. Per ogni OTA vedi anche come si
            ripartisce tra gli appartamenti nel periodo filtrato.
          </p>
          <DataTable
            headers={[
              "Piattaforma",
              "Lordo",
              "Commissioni",
              "Netto in banca",
              "Contanti",
              "Totale netto",
              "Dettaglio appartamenti",
            ]}
          >
            {activePlatforms.map((platform) => (
              <DataRow key={platform.platformId}>
                <td className="px-2 py-2 font-medium text-rc-ink">
                  {platform.name}
                  {platform.isCash ? (
                    <span className="ml-2 text-xs font-normal text-rc-muted">
                      (contanti)
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <Money value={platform.gross} />
                </td>
                <td className="px-2 py-2">
                  {platform.commission > 0 ? (
                    <Money value={platform.commission} />
                  ) : (
                    <span className="text-rc-muted">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {platform.bankNet > 0 ? (
                    <Money value={platform.bankNet} />
                  ) : (
                    <span className="text-rc-muted">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {platform.cash > 0 ? (
                    <Money value={platform.cash} />
                  ) : (
                    <span className="text-rc-muted">—</span>
                  )}
                </td>
                <td className="px-2 py-2 font-semibold">
                  <Money value={platform.totalNet} />
                </td>
                <td className="px-2 py-2 text-sm text-rc-muted">
                  {formatDetailItems(platform.properties)}
                </td>
              </DataRow>
            ))}
            <DataRow>
              <td className="px-2 py-2 font-semibold text-rc-ink">Totale</td>
              <td className="px-2 py-2 font-semibold">
                <Money value={Math.round(totalPlatformGross * 100) / 100} />
              </td>
              <td className="px-2 py-2 font-semibold">
                <Money value={summary.bankCommission} />
              </td>
              <td className="px-2 py-2 font-semibold">
                <Money value={summary.bankNet} />
              </td>
              <td className="px-2 py-2 font-semibold">
                {summary.cashTotal > 0 ? (
                  <Money value={summary.cashTotal} />
                ) : (
                  <span className="text-rc-muted">—</span>
                )}
              </td>
              <td className="px-2 py-2 font-semibold">
                <Money value={summary.grandNet} />
              </td>
              <td className="px-2 py-2 text-sm text-rc-muted">—</td>
            </DataRow>
          </DataTable>
        </div>
      ) : null}

      {activeProperties.length > 0 ? (
        <div className="mt-8">
          <p className="mb-3 text-sm font-medium text-rc-gold-light">
            Suddivisione per appartamento
          </p>
          <p className="mb-4 text-sm text-rc-muted">
            Quota di ogni unità sul totale netto (banca dopo commissioni +
            contanti). Il conto è quello impostato in Impostazioni per
            l&apos;appartamento.
          </p>
          <DataTable
            headers={[
              "Appartamento",
              "Conto accredito",
              "Lordo",
              "Commissioni",
              "Netto in banca",
              "Contanti",
              "Totale netto",
              "Dettaglio OTA",
            ]}
          >
            {activeProperties.map((property) => (
              <DataRow key={property.propertyId}>
                <td className="px-2 py-2 font-medium text-rc-ink">
                  {property.name}
                </td>
                <td className="px-2 py-2 text-sm text-rc-muted">
                  {property.accountLabel}
                </td>
                <td className="px-2 py-2">
                  <Money value={property.gross} />
                </td>
                <td className="px-2 py-2">
                  <Money value={property.commission} />
                </td>
                <td className="px-2 py-2">
                  <Money value={property.bankNet} />
                </td>
                <td className="px-2 py-2">
                  {property.cash > 0 ? (
                    <Money value={property.cash} />
                  ) : (
                    <span className="text-rc-muted">—</span>
                  )}
                </td>
                <td className="px-2 py-2 font-semibold">
                  <Money value={property.totalNet} />
                </td>
                <td className="px-2 py-2 text-sm text-rc-muted">
                  {formatDetailItems(property.platforms)}
                </td>
              </DataRow>
            ))}
            <DataRow>
              <td className="px-2 py-2 font-semibold text-rc-ink">Totale</td>
              <td className="px-2 py-2 text-sm text-rc-muted">—</td>
              <td className="px-2 py-2 font-semibold">
                <Money value={Math.round(totalPropertyGross * 100) / 100} />
              </td>
              <td className="px-2 py-2 font-semibold">
                <Money value={summary.bankCommission} />
              </td>
              <td className="px-2 py-2 font-semibold">
                <Money value={summary.bankNet} />
              </td>
              <td className="px-2 py-2 font-semibold">
                {summary.cashTotal > 0 ? (
                  <Money value={summary.cashTotal} />
                ) : (
                  <span className="text-rc-muted">—</span>
                )}
              </td>
              <td className="px-2 py-2 font-semibold">
                <Money value={summary.grandNet} />
              </td>
              <td className="px-2 py-2 text-sm text-rc-muted">
                {formatDetailItems(
                  activePlatforms.map((platform) => ({
                    name: platform.name,
                    net: platform.totalNet,
                  })),
                )}
              </td>
            </DataRow>
          </DataTable>
        </div>
      ) : null}
    </Card>
  );
}
