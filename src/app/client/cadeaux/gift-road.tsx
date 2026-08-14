"use client";

import { motion } from "framer-motion";
import { Check, Gift, LockKeyhole, Sparkles } from "lucide-react";
import { DEFAULT_LOYALTY_GIFT_STEPS, type LoyaltyGiftStep } from "@/lib/loyalty-constants";

type GiftRoadProps = {
  currentStep: number;
  cycle: number;
  cycleEnabled: boolean;
  steps?: LoyaltyGiftStep[];
};

const POSITIONS = [
  { left: 18, top: 82 },
  { left: 67, top: 70 },
  { left: 25, top: 58 },
  { left: 69, top: 46 },
  { left: 29, top: 34 },
  { left: 67, top: 22 },
  { left: 38, top: 10 },
] as const;

export function GiftRoad({ currentStep, cycle, cycleEnabled, steps = DEFAULT_LOYALTY_GIFT_STEPS }: GiftRoadProps) {
  const rewards = new Map(steps.map((step) => [step.milestone, step]));
  const items = Array.from({ length: 7 }, (_, index) => {
    const milestone = index + 1;
    return {
      milestone,
      reward: rewards.get(milestone),
      state: milestone <= currentStep ? "done" : milestone === currentStep + 1 ? "next" : "locked",
      position: POSITIONS[index],
    } as const;
  });

  return (
    <section className="gift-road-stage" aria-label="Route animée des cadeaux Compétence" data-gift-road>
      <div className="gift-road-sky" aria-hidden>
        <span className="gift-cloud gift-cloud-a" />
        <span className="gift-cloud gift-cloud-b" />
        <span className="gift-horizon">La route continue</span>
      </div>

      <svg className="gift-road-svg" viewBox="0 0 800 1500" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="road" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#24305f" />
            <stop offset="0.5" stopColor="#111B4D" />
            <stop offset="1" stopColor="#07102f" />
          </linearGradient>
          <filter id="road-shadow" x="-30%" y="-20%" width="160%" height="160%">
            <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#0b1438" floodOpacity="0.22" />
          </filter>
        </defs>
        <path
          d="M315 1560 C720 1380 710 1225 360 1125 C15 1025 50 850 390 760 C750 665 720 485 365 390 C45 305 95 125 485 -70"
          fill="none"
          stroke="url(#road)"
          strokeWidth="178"
          strokeLinecap="round"
          filter="url(#road-shadow)"
        />
        <path
          className="gift-road-centerline"
          d="M315 1560 C720 1380 710 1225 360 1125 C15 1025 50 850 390 760 C750 665 720 485 365 390 C45 305 95 125 485 -70"
          fill="none"
          stroke="#F4C542"
          strokeWidth="8"
          strokeDasharray="28 34"
          strokeLinecap="round"
        />
      </svg>

      <div className="gift-road-start">Départ · cycle {cycle}</div>
      {items.map(({ milestone, reward, state, position }, index) => (
        <motion.article
          key={milestone}
          className={`gift-road-node gift-road-node-${state}`}
          style={{ left: `${position.left}%`, top: `${position.top}%` }}
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: state === "next" ? [0, -7, 0] : 0, scale: 1 }}
          transition={{ delay: index * 0.06, duration: state === "next" ? 2.4 : 0.45, repeat: state === "next" ? Infinity : 0 }}
        >
          <span className="gift-node-orb">
            {state === "done" ? <Check aria-hidden /> : state === "locked" ? <LockKeyhole aria-hidden /> : <Gift aria-hidden />}
          </span>
          <span className="gift-node-copy">
            <strong>{milestone === 1 ? "Bienvenue" : `${milestone}ᵉ paiement`}</strong>
            <small>
              {milestone === 1
                ? "-10 % partenaire"
                : reward
                  ? `-${reward.discountRate} % · ${reward.validityDays} jours`
                  : "Étape fidélité"}
            </small>
          </span>
          {state === "next" && <Sparkles className="gift-node-sparkle" aria-hidden />}
        </motion.article>
      ))}

      <motion.div
        className="gift-road-future"
        animate={{ y: [0, -6, 0], opacity: [0.72, 1, 0.72] }}
        transition={{ duration: 2.8, repeat: Infinity }}
      >
        <Gift aria-hidden />
        <span>{cycleEnabled ? "Prochain cycle" : "De nouvelles surprises arrivent"}</span>
      </motion.div>

      <style jsx>{`
        .gift-road-stage { position: relative; min-height: 1050px; overflow: hidden; border: 1px solid #dfe6f2; border-radius: 28px; background: linear-gradient(180deg,#f8fbff 0%,#fff 38%,#f7f9fc 100%); isolation: isolate; }
        .gift-road-sky { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .gift-horizon { position: absolute; left: 50%; top: 2.3%; transform: translateX(-50%); color: #64748b; font-size: .7rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; white-space: nowrap; }
        .gift-cloud { position: absolute; width: 135px; height: 34px; border-radius: 999px; background: rgba(255,255,255,.9); box-shadow: 0 12px 35px rgba(17,27,77,.08); animation: cloud 14s ease-in-out infinite alternate; }
        .gift-cloud::before,.gift-cloud::after { content:""; position:absolute; border-radius:50%; background:inherit; }
        .gift-cloud::before { width:55px;height:55px;left:18px;bottom:0; }.gift-cloud::after { width:70px;height:70px;right:15px;bottom:-3px; }
        .gift-cloud-a { left:-45px; top:8%; }.gift-cloud-b { right:-50px; top:26%; animation-delay:-5s; }
        .gift-road-svg { position:absolute; inset:0; width:100%; height:100%; }
        .gift-road-centerline { animation: road-flow 2.8s linear infinite; }
        .gift-road-start { position:absolute; left:50%; bottom:2.3%; transform:translateX(-50%); border:1px solid #d8dee9; border-radius:999px; background:#fff; color:#111b4d; padding:.55rem .9rem; font-size:.7rem; font-weight:900; text-transform:uppercase; letter-spacing:.08em; box-shadow:0 10px 25px rgba(17,27,77,.12); }
        .gift-road-node { position:absolute; z-index:3; display:flex; align-items:center; gap:.55rem; width:min(185px,42vw); transform:translate(-50%,-50%); border:1px solid #dfe6f2; border-radius:18px; background:rgba(255,255,255,.96); padding:.55rem; box-shadow:0 14px 34px rgba(17,27,77,.16); backdrop-filter:blur(10px); }
        .gift-node-orb { display:flex; width:42px; height:42px; flex:none; align-items:center; justify-content:center; border-radius:14px; background:#111b4d; color:#fff; box-shadow:0 8px 20px rgba(17,27,77,.2); }
        .gift-node-orb :global(svg) { width:20px;height:20px; }
        .gift-node-copy { min-width:0; display:block; }.gift-node-copy strong,.gift-node-copy small { display:block; }.gift-node-copy strong { color:#111827;font-size:.78rem;line-height:1.15; }.gift-node-copy small { margin-top:.18rem;color:#64748b;font-size:.66rem;font-weight:750;line-height:1.25; }
        .gift-road-node-done .gift-node-orb { background:#0f766e; }.gift-road-node-done { border-color:#b7e3d8; }
        .gift-road-node-next { border-color:#e8c654; box-shadow:0 18px 44px rgba(218,161,0,.24); }.gift-road-node-next .gift-node-orb { background:#d89b00; color:#fff; }
        .gift-road-node-locked { opacity:.82; }.gift-road-node-locked .gift-node-orb { background:#eef2f7;color:#64748b;box-shadow:none; }
        .gift-node-sparkle { position:absolute; width:18px;right:-7px;top:-8px;color:#d89b00; }
        .gift-road-future { position:absolute; z-index:4; left:50%; top:4.8%; transform:translateX(-50%); display:flex; align-items:center; gap:.45rem; border:1px solid #e8d7a0; border-radius:999px; background:#fff9e8; color:#6b4f00; padding:.45rem .7rem; font-size:.64rem; font-weight:850; white-space:nowrap; }
        .gift-road-future :global(svg) { width:15px;height:15px; }
        @keyframes road-flow { to { stroke-dashoffset:-62; } }
        @keyframes cloud { to { transform:translateX(36px); } }
        @media (min-width: 720px) { .gift-road-stage{min-height:1180px}.gift-road-node{width:220px;padding:.7rem}.gift-node-orb{width:48px;height:48px}.gift-node-copy strong{font-size:.9rem}.gift-node-copy small{font-size:.75rem} }
        @media (prefers-reduced-motion: reduce) { .gift-road-centerline,.gift-cloud{animation:none!important;} }
      `}</style>
    </section>
  );
}
