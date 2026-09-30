"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { clearPrefs } from "@/lib/prefs";
import { ButtonLink, Icon, IconCircle, Logo } from "@/components/ui";

const STEPS = [
  { n: 1, bg: "bg-lavender", title: "Connect your bank", body: "Securely connect your bank account in the app, or upload your own statement." },
  { n: 2, bg: "bg-mint", title: "Check what we found", body: "Fix anything we labelled wrong before we calculate." },
  { n: 3, bg: "bg-pink", title: "Share one verified page", body: "It answers “can you pay?” and nothing more." },
];

export default function Welcome() {
  // Create the demo session (and warm up the Python function) as soon as the app opens.
  useEffect(() => {
    api<{ new: boolean }>("/session", { method: "POST" })
      .then((r) => r.new && clearPrefs()) // fresh session: forget the previous run's bank and proof choices
      .catch(() => {});
  }, []);

  return (
    // Spacing and heading scale with screen height so everything fits on one phone screen
    <div className="flex min-h-dvh flex-col gap-[clamp(10px,1.8dvh,26px)] px-5 pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-[20px] font-semibold tracking-[-0.02em]">EarnSure</span>
        </div>
        <button type="button" aria-label="Help"
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-btn">
          <Icon name="help" />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        <h1 className="m-0 text-[clamp(26px,4.2dvh,40px)] leading-[1.08] tracking-[-0.035em]">Financial intelligence for irregular earners</h1>
        <p className="m-0 text-[15px] leading-[1.45] text-muted">
          We turn your income activity into one verified page a landlord can trust, with no payslip needed.
        </p>
      </div>

      <div className="flex flex-col gap-2.5 rounded-card border border-hair bg-white p-4 shadow-card">
        <div className="text-[14px] font-medium text-muted">How it works</div>
        {STEPS.map((s) => (
          <div key={s.n} className="flex items-center gap-3.5">
            <IconCircle size={40} className={`${s.bg} text-[15px] font-semibold`}>{s.n}</IconCircle>
            <div>
              <div className="text-[15px] font-medium tracking-[-0.01em]">{s.title}</div>
              <div className="text-[13px] leading-[1.4] text-muted">{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-tile bg-soft py-2.5 pl-3 pr-4 text-[13px] leading-[1.4] text-sub">
        <IconCircle size={36} className="border border-field-line bg-white">
          <Icon name="shield" size={18} stroke="#17756B" width={1.9} />
        </IconCircle>
        <span>We never show your transactions or who you work for.</span>
      </div>

      <div className="grow" />
      {/* Sticky so the button stays on screen even on the smallest phones */}
      <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 bg-white px-5 pb-4 pt-1">
        <ButtonLink href="/sign-in" className="min-h-12!">Get started</ButtonLink>
      </div>
    </div>
  );
}
