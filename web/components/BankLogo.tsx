"use client";

import Image from "next/image";
import { useState } from "react";

/** Bank logo in a white circle; falls back to initials if the image fails to load. */
export default function BankLogo({ name, logo, initials, size = 40, fallbackClass = "bg-lavender text-primary-dark" }: {
  name: string; logo?: string; initials: string; size?: number; fallbackClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed)
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${fallbackClass}`}
        style={{ width: size, height: size }} aria-hidden="true">
        {initials}
      </span>
    );
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-hair bg-white"
      style={{ width: size, height: size }}>
      <Image src={logo} alt={`${name} logo`} width={size} height={size} unoptimized onError={() => setFailed(true)}
        className="h-full w-full object-cover" />
    </span>
  );
}
