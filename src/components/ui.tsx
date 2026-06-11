import type { ReactNode } from "react";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import { CHART_COLORS } from "@/lib/brand";
import { KpiProgressBar, Sparkline } from "./charts";

export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rc-card rounded-2xl p-5 ${className}`}>
      {title ? (
        <div className="mb-4 border-b border-rc-gold/30 pb-3">
          <h2 className="font-[family-name:var(--font-cormorant)] text-xl font-semibold tracking-wide text-white">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-rc-muted">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  sparkline,
  sparklineColor,
  progress,
  progressMax,
  progressLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative" | "income" | "expense";
  sparkline?: number[];
  sparklineColor?: string;
  progress?: number;
  progressMax?: number;
  progressLabel?: string;
}) {
  const tones = {
    neutral: "border-rc-gold/35 bg-rc-surface-elevated text-rc-ink",
    positive: "border-emerald-500/30 bg-emerald-950/40 text-emerald-100",
    negative: "border-rose-500/30 bg-rose-950/40 text-rose-100",
    income: "border-rc-gold/35 bg-rc-charcoal text-rc-ink",
    expense: "border-amber-500/30 bg-amber-950/35 text-amber-100",
  };

  const accents = {
    neutral: "text-rc-gold",
    positive: "text-emerald-400",
    negative: "text-rose-400",
    income: "text-rc-gold-light",
    expense: "text-amber-400",
  };

  const chartColors = {
    neutral: CHART_COLORS.income,
    positive: CHART_COLORS.profit,
    negative: CHART_COLORS.loss,
    income: CHART_COLORS.income,
    expense: CHART_COLORS.expense,
  };

  const chartColor = sparklineColor ?? chartColors[tone];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <p
        className={`text-xs font-semibold uppercase tracking-[0.14em] ${accents[tone]}`}
      >
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-rc-gold-light">
        {value}
      </p>
      {hint ? <p className="mt-1 text-sm text-rc-muted">{hint}</p> : null}
      {sparkline && sparkline.some((point) => point > 0) ? (
        <div className="mt-3 opacity-90">
          <Sparkline values={sparkline} color={chartColor} />
        </div>
      ) : null}
      {progress !== undefined && progressMax !== undefined && progressMax > 0 ? (
        <KpiProgressBar
          value={progress}
          max={progressMax}
          color={chartColor}
          label={progressLabel}
        />
      ) : null}
    </div>
  );
}

export function Money({ value }: { value: number }) {
  return <span className="font-medium tabular-nums">{formatCurrency(value)}</span>;
}

export function Percent({ value }: { value: number }) {
  return <span className="font-medium tabular-nums">{formatPercent(value)}</span>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-rc-gold-light">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-xl border border-rc-gold/35 bg-rc-charcoal px-3 py-2 text-sm text-rc-ink outline-none transition placeholder:text-rc-muted focus:border-rc-gold focus:ring-2 focus:ring-rc-gold/30 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`rounded-xl border border-rc-gold/35 bg-rc-charcoal px-3 py-2 text-sm text-rc-ink outline-none transition placeholder:text-rc-muted focus:border-rc-gold focus:ring-2 focus:ring-rc-gold/30 ${props.className ?? ""}`}
    />
  );
}

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variants = {
    primary:
      "rc-gold-gradient border border-rc-gold-dark/40 text-rc-black shadow-sm hover:brightness-105",
    secondary:
      "border border-rc-gold/40 bg-rc-surface-elevated text-rc-gold-light hover:border-rc-gold hover:bg-rc-charcoal",
    danger:
      "border border-rose-500/35 bg-rose-950/50 text-rose-200 hover:bg-rose-950/70",
    ghost:
      "border border-transparent bg-transparent text-rc-gold-light hover:bg-white/8",
  };

  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-2 text-sm font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function BarChart({
  items,
}: {
  items: { label: string; value: number; color?: string }[];
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-rc-muted">{item.label}</span>
            <Money value={item.value} />
          </div>
          <div className="h-2.5 rounded-full bg-rc-cream-dark">
            <div
              className="h-2.5 rounded-full transition-all"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color ?? CHART_COLORS.income,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-rc-gold/35 bg-rc-charcoal/60 px-4 py-8 text-center text-sm text-rc-muted">
      {message}
    </div>
  );
}

export function TabPill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold tracking-wide transition ${
        active
          ? "rc-gold-gradient text-rc-black shadow-sm"
          : "border border-rc-gold/20 bg-rc-surface-elevated text-rc-muted hover:border-rc-gold/40 hover:text-rc-gold-light"
      }`}
    >
      {children}
    </button>
  );
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-rc-gold/35 text-left text-rc-gold-light/80">
            {headers.map((header) => (
              <th
                key={header}
                className="px-2 py-2 font-semibold uppercase tracking-wide"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function DataRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-rc-gold/15 transition hover:bg-rc-gold/8">
      {children}
    </tr>
  );
}
