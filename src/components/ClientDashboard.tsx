"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { BrandTitle } from "./BrandTitle";

export const ClientDashboard = dynamic(
  () => import("./Dashboard").then((module) => module.Dashboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 rc-main-pattern text-rc-muted">
        <Image
          src="/brand/logo-mark.png"
          alt={BRAND.name}
          width={96}
          height={96}
          className="h-28 w-28 animate-pulse object-contain"
        />
        <BrandTitle size="sm" showTagline />
        <p className="text-sm font-medium tracking-[0.18em] uppercase">
          Caricamento dashboard...
        </p>
      </div>
    ),
  },
);
