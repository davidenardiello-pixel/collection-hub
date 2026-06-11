import { BRAND } from "@/lib/brand";

export function BrandTitle({
  size = "lg",
  showTagline = false,
  light = false,
}: {
  size?: "sm" | "lg";
  showTagline?: boolean;
  light?: boolean;
}) {
  const scriptSize = size === "lg" ? "text-5xl md:text-7xl" : "text-4xl md:text-5xl";
  const collectionSize = size === "lg" ? "text-sm md:text-base" : "text-xs";
  const romeColor = light ? "text-rc-gold-light" : "text-rc-gold";
  const collectionColor = light ? "text-white" : "text-rc-gold-light";

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className={`rc-script ${scriptSize} leading-none ${romeColor}`}>
          Rome
        </span>
        <span
          className={`rc-brand-collection ${collectionSize} pb-1 font-bold uppercase ${collectionColor}`}
        >
          Collection
        </span>
      </div>
      {showTagline ? (
        <p
          className={`mt-2 text-xs tracking-[0.24em] uppercase ${
            light ? "text-rc-gold-light/80" : "text-rc-muted"
          }`}
        >
          {BRAND.tagline}
        </p>
      ) : null}
    </div>
  );
}
