import Link from "next/link";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/api";

// --- Icons (stroke icons from the prototype) -----------------------------------

const PATHS = {
  back: "M19 12H5M11 6l-6 6 6 6",
  help: "M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.4v.4M12 16.8v.2",
  home: "M3 11l9-7 9 7v9H15v-6H9v6H3z",
  trends: "M4 20V11M10 20V5M16 20v-8M21 20H3",
  check: "M4 12.5l5 5L20 6.5",
  proof: "M7 3h7l5 5v13H7zM14 3v5h5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  shieldCheck: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0",
  warn: "M12 8v5M12 16.5v.5M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  chevron: "M9 5l7 7-7 7",
  bank: "M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18M12 3l9 5H3z",
  plus: "M12 5v14M5 12h14",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  x: "M6 6l12 12M18 6L6 18",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  dip: "M3 7l6 6 4-4 8 8M21 11v6h-6",
  recover: "M3 17l6-6 4 4 8-8M21 13V7h-6",
  logo: "M5 22l6-7 5 5 6-9 5 6",
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, stroke = "currentColor", width = 1.8 }: {
  name: IconName; size?: number; stroke?: string; width?: number;
}) {
  if (name === "help")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d={PATHS.help} />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox={name === "logo" ? "0 0 32 32" : "0 0 24 24"} fill="none"
      stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Logo({ size = 52 }: { size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-primary" style={{ width: size, height: size }}>
      <Icon name="logo" size={size / 2} stroke="#fff" width={2.6} />
    </span>
  );
}

export function IconCircle({ children, className = "", size = 44 }: {
  children: ReactNode; className?: string; size?: number;
}) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

// --- Layout --------------------------------------------------------------------

export function Screen({ children, nav = false }: { children: ReactNode; nav?: boolean }) {
  return (
    <div className={`flex min-h-dvh flex-col gap-4 px-5 pt-5 ${nav ? "pb-[108px]" : "pb-7"}`}>{children}</div>
  );
}

const roundBtn = "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-btn text-ink";

export function TopBar({ title, back, left, right }: {
  title: string; back?: string; left?: ReactNode; right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      {left ??
        (back ? (
          <Link href={back} aria-label="Back" className={roundBtn}>
            <Icon name="back" />
          </Link>
        ) : (
          <span className="w-[52px]" />
        ))}
      <span className="text-[18px] font-medium tracking-[-0.01em]">{title}</span>
      {right ?? (
        <button type="button" aria-label="Help" className={roundBtn}>
          <Icon name="help" />
        </button>
      )}
    </div>
  );
}

export function PageTitle({ children, sub, size = 32 }: { children: ReactNode; sub?: ReactNode; size?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="m-0 leading-[1.1]" style={{ fontSize: size }}>{children}</h1>
      {sub && <p className="m-0 text-[15px] leading-normal text-muted">{sub}</p>}
    </div>
  );
}

export function Card({ children, className = "", highlight }: {
  children: ReactNode; className?: string; highlight?: "violet" | Tone;
}) {
  const border = {
    violet: "border-[1.5px] border-highlight",
    green: "border-[1.5px] border-green-line",
    amber: "border-[1.5px] border-amber-line",
    red: "border-[1.5px] border-red-line",
  }[highlight ?? "violet"];
  return (
    <div className={`rounded-card bg-white shadow-card ${highlight ? border : "border border-hair"} ${className}`}>
      {children}
    </div>
  );
}

export function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-tile bg-soft ${className}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[14px] font-medium text-muted">{children}</div>;
}

const PILL_TONES: Record<Tone | "grey" | "teal", string> = {
  green: "text-green-ink border-green-line",
  amber: "text-amber border-amber-line",
  red: "text-red-ink border-red-line",
  grey: "text-sub border-[#E2E2E7]",
  teal: "text-[#0E6573] border-[#8CCBD4]",
};

export function Pill({ tone = "grey", children, size = "md" }: {
  tone?: Tone | "grey" | "teal"; children: ReactNode; size?: "sm" | "md";
}) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border bg-white font-medium ${PILL_TONES[tone]} ${
      size === "sm" ? "px-2 py-px text-[11px]" : "px-3 py-1 text-[13px]"}`}>
      {children}
    </span>
  );
}

// --- Buttons ---------------------------------------------------------------------

const BTN = {
  primary: "border-0 bg-primary text-white shadow-cta hover:bg-primary-dark",
  secondary: "border border-line bg-white text-ink",
  black: "border-0 bg-ink text-white",
  danger: "border border-red-line bg-white text-red",
};

export function ButtonLink({ href, children, variant = "primary", className = "" }: {
  href: string; children: ReactNode; variant?: keyof typeof BTN; className?: string;
}) {
  return (
    <Link href={href}
      className={`flex min-h-14 items-center justify-center rounded-full text-[17px] font-medium tracking-[-0.01em] no-underline ${BTN[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN }) {
  return (
    <button type="button"
      className={`flex min-h-14 cursor-pointer items-center justify-center rounded-full text-[17px] font-medium tracking-[-0.01em] disabled:cursor-not-allowed disabled:opacity-50 ${BTN[variant]} ${className}`}
      {...props}>
      {children}
    </button>
  );
}

// --- Bottom nav --------------------------------------------------------------------

const NAV = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/trends", label: "Trends", icon: "trends" },
  { href: "/afford", label: "Afford", icon: "check" },
  { href: "/proof", label: "Proof", icon: "proof" },
  // Rights (/rights) is hidden for now; the page code is kept
] as const;

export function BottomNav({ active }: { active: (typeof NAV)[number]["label"] | "Rights" }) {
  return (
    <nav aria-label="Main"
      className="fixed bottom-4 left-1/2 z-10 flex h-[72px] w-[calc(min(100vw,390px)-24px)] -translate-x-1/2 items-center justify-between rounded-full bg-night p-2 shadow-nav">
      {NAV.map((n) =>
        n.label === active ? (
          <Link key={n.href} href={n.href} aria-current="page"
            className="flex h-14 items-center gap-2.5 rounded-full bg-primary pl-1.5 pr-5 text-[15px] font-medium text-white no-underline">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-[#A195F4] bg-[#5A4AD8]">
              <Icon name={n.icon} size={19} />
            </span>
            {n.label}
          </Link>
        ) : (
          <Link key={n.href} href={n.href} aria-label={n.label}
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-[#3A3A46] bg-[#1F1F29] text-[#D4D4DC]">
            <Icon name={n.icon} size={19} />
          </Link>
        ),
      )}
    </nav>
  );
}

// --- States --------------------------------------------------------------------------

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col gap-3" aria-live="polite">
      <span className="sr-only">{label}</span>
      {[120, 88, 160].map((h, i) => (
        <div key={i} className="animate-pulse rounded-card bg-soft" style={{ height: h }} />
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-tile border border-red-line bg-red-bg p-4 text-[14px] text-red-ink">
      <span className="grow">Something went wrong: {message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-11 rounded-full bg-white px-4 font-medium text-ink">
          Retry
        </button>
      )}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />;
}
