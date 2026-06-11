"use client";

import { formatCurrency, formatPercent } from "@/lib/calculations";
import { CHART_COLORS } from "@/lib/brand";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function Sparkline({
  values,
  color = CHART_COLORS.income,
  height = 44,
  width = "100%",
  filled = true,
}: {
  values: number[];
  color?: string;
  height?: number;
  width?: number | string;
  filled?: boolean;
}) {
  if (values.length === 0) {
    return null;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const padding = 4;
  const innerW = 100;
  const innerH = height - padding * 2;

  const points = values.map((value, index) => {
    const x = values.length === 1 ? innerW / 2 : (index / (values.length - 1)) * innerW;
    const y = padding + innerH - ((value - min) / range) * innerH;
    return { x, y };
  });

  const linePath = points.map((point, i) => `${i === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const areaPath = `${linePath} L${innerW},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${innerW} ${height}`}
      width={width}
      height={height}
      className="overflow-visible"
      preserveAspectRatio="none"
      aria-hidden
    >
      {filled ? (
        <path d={areaPath} fill={color} fillOpacity={0.18} />
      ) : null}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="2.5"
          fill={color}
          opacity={index === points.length - 1 ? 1 : 0.45}
        />
      ))}
    </svg>
  );
}

export function RingGauge({
  value,
  max = 1,
  label,
  sublabel,
  color = CHART_COLORS.income,
  size = 88,
  format = "percent",
}: {
  value: number;
  max?: number;
  label: string;
  sublabel?: string;
  color?: string;
  size?: number;
  format?: "percent" | "currency" | "number";
}) {
  const ratio = clamp(max > 0 ? value / max : 0, 0, 1);
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - ratio);

  const display =
    format === "percent"
      ? formatPercent(value)
      : format === "currency"
        ? formatCurrency(value)
        : String(Math.round(value));

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(212,176,106,0.15)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-[family-name:var(--font-cormorant)] text-lg font-semibold text-rc-gold-light">
            {display}
          </span>
          {format === "percent" && max === 1 ? (
            <span className="text-[10px] text-rc-muted">del totale</span>
          ) : null}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-rc-gold">
          {label}
        </p>
        {sublabel ? (
          <p className="mt-0.5 text-xs text-rc-muted">{sublabel}</p>
        ) : null}
      </div>
    </div>
  );
}

export function DonutChart({
  segments,
  centerLabel,
  centerSub,
  size = 160,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel?: string;
  centerSub?: string;
  size?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const arcs = segments.reduce<
    { segment: (typeof segments)[number]; offset: number; portion: number }[]
  >((result, segment) => {
    const portion = total > 0 ? segment.value / total : 0;
    const offset = result.reduce((sum, arc) => sum + arc.portion, 0);
    return [...result, { segment, offset, portion }];
  }, []);

  if (total <= 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-rc-muted">
        Nessun dato da visualizzare
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-center lg:justify-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(212,176,106,0.12)"
            strokeWidth={stroke}
          />
          {arcs.map(({ segment, offset, portion }) => {
            const dash = circumference * portion;
            const gap = circumference - dash;
            return (
              <circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-circumference * offset}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>
        {(centerLabel || centerSub) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            {centerLabel ? (
              <span className="font-[family-name:var(--font-cormorant)] text-xl font-semibold text-rc-gold-light">
                {centerLabel}
              </span>
            ) : null}
            {centerSub ? (
              <span className="text-xs text-rc-muted">{centerSub}</span>
            ) : null}
          </div>
        )}
      </div>
      <div className="space-y-2 text-sm">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-rc-muted">{segment.label}</span>
            <span className="ml-auto font-medium tabular-nums text-rc-ink">
              {formatCurrency(segment.value)}
            </span>
            <span className="w-10 text-right text-xs text-rc-muted">
              {formatPercent(segment.value / total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthlyTrendChart({
  months,
}: {
  months: {
    label: string;
    income: number;
    expenses: number;
    profit: number;
  }[];
}) {
  const active = months.filter((month) => month.income > 0 || month.expenses > 0);
  if (active.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-rc-muted">
        Nessun dato mensile disponibile
      </p>
    );
  }

  const maxValue = Math.max(
    ...active.flatMap((month) => [month.income, month.expenses, Math.abs(month.profit)]),
    1,
  );
  const chartHeight = 180;
  const chartWidth = 100;
  const barGroupWidth = chartWidth / active.length;
  const barWidth = barGroupWidth * 0.22;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-rc-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS.income }} />
          Incassi
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS.expense }} />
          Spese
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS.profit }} />
          Profitto
        </span>
      </div>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`}
        className="w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        {active.map((month, index) => {
          const groupX = index * barGroupWidth + barGroupWidth / 2;
          const incomeH = (month.income / maxValue) * chartHeight;
          const expenseH = (month.expenses / maxValue) * chartHeight;
          const profitH = (Math.abs(month.profit) / maxValue) * chartHeight;
          const profitY =
            month.profit >= 0
              ? chartHeight - profitH
              : chartHeight;

          return (
            <g key={month.label}>
              <rect
                x={groupX - barWidth * 1.5}
                y={chartHeight - incomeH}
                width={barWidth}
                height={incomeH}
                rx="1"
                fill={CHART_COLORS.income}
                opacity={0.9}
              />
              <rect
                x={groupX - barWidth * 0.5}
                y={chartHeight - expenseH}
                width={barWidth}
                height={expenseH}
                rx="1"
                fill={CHART_COLORS.expense}
                opacity={0.9}
              />
              <rect
                x={groupX + barWidth * 0.5}
                y={profitY}
                width={barWidth}
                height={profitH}
                rx="1"
                fill={month.profit >= 0 ? CHART_COLORS.profit : CHART_COLORS.loss}
                opacity={0.95}
              />
              <text
                x={groupX}
                y={chartHeight + 14}
                textAnchor="middle"
                fill="currentColor"
                className="text-[3px] fill-rc-muted"
              >
                {month.label.slice(0, 3)}
              </text>
            </g>
          );
        })}
        <line
          x1="0"
          y1={chartHeight}
          x2={chartWidth}
          y2={chartHeight}
          stroke="rgba(212,176,106,0.25)"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}

export function KpiProgressBar({
  value,
  max,
  color = CHART_COLORS.income,
  label,
}: {
  value: number;
  max: number;
  color?: string;
  label?: string;
}) {
  const ratio = max > 0 ? clamp(value / max, 0, 1) : 0;

  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-[10px] text-rc-muted">
        <span>{label ?? "Progresso"}</span>
        <span>{formatPercent(ratio)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-rc-cream-dark">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${ratio * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
