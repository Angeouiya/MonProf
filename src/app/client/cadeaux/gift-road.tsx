"use client";

import { motion } from "framer-motion";
import { Check, Gift, LockKeyhole, Sparkles } from "lucide-react";
import { DEFAULT_LOYALTY_GIFT_STEPS, type LoyaltyGiftStep } from "@/lib/loyalty-constants";

type GiftRoadProps = {
  cycle: number;
  cycleEnabled: boolean;
  qualifiedPaymentCount: number;
  steps?: LoyaltyGiftStep[];
};

const POSITIONS = [
  { left: 39, top: 8 },
  { left: 68, top: 15 },
  { left: 70, top: 22 },
  { left: 31, top: 29 },
  { left: 27, top: 36 },
  { left: 66, top: 43 },
  { left: 71, top: 50 },
  { left: 33, top: 57 },
  { left: 28, top: 64 },
  { left: 66, top: 71 },
  { left: 71, top: 78 },
  { left: 34, top: 85 },
  { left: 40, top: 92 },
] as const;

const MAIN_ROAD = "M390 -90 C720 55 720 225 410 305 C75 390 92 560 448 640 C770 713 724 900 385 962 C62 1020 92 1205 430 1280 C710 1342 704 1500 375 1660";

export function GiftRoad({ cycle, cycleEnabled, qualifiedPaymentCount, steps = DEFAULT_LOYALTY_GIFT_STEPS }: GiftRoadProps) {
  const cycleSpan = steps.reduce((total, step) => total + step.paymentGap, 0);
  const cycleStartPayment = 1 + Math.max(0, cycle - 1) * cycleSpan;
  let rewardPaymentNumber = cycleStartPayment;
  const rewardsByPayment = new Map<number, LoyaltyGiftStep>();
  for (const step of steps) {
    rewardPaymentNumber += step.paymentGap;
    rewardsByPayment.set(rewardPaymentNumber, step);
  }
  const items = POSITIONS.map((position, index) => {
    const paymentNumber = cycleStartPayment + index;
    const reward = rewardsByPayment.get(paymentNumber);
    return {
      paymentNumber,
      reward,
      state: paymentNumber <= qualifiedPaymentCount ? "done" : paymentNumber === qualifiedPaymentCount + 1 ? "next" : "locked",
      position,
    } as const;
  });

  return (
    <section className="gift-road-stage" aria-label="Route illustrée et animée des cadeaux Compétence" data-gift-road>
      <div className="gift-road-title" aria-hidden>
        <span>Route {cycle}</span>
        <strong>Ramassez les cadeaux</strong>
      </div>

      <svg className="gift-road-svg" viewBox="0 0 800 1600" preserveAspectRatio="none" aria-hidden>
        <g className="gift-ground-details">
          <path d="M52 115 C84 94 113 99 126 128 C94 132 74 143 63 166 C48 151 43 132 52 115Z" fill="#B9D8AF" />
          <path d="M62 159 L73 122 M71 145 L98 117 M74 151 L106 145" stroke="#4B946B" strokeWidth="7" strokeLinecap="round" />
          <path d="M650 478 C684 451 722 458 735 494 C702 496 675 514 666 544 C646 528 640 500 650 478Z" fill="#B9D8AF" />
          <path d="M666 535 L680 487 M676 514 L712 480 M681 522 L719 514" stroke="#4B946B" strokeWidth="7" strokeLinecap="round" />
          <path d="M54 910 C88 884 124 891 137 927 C103 929 78 947 68 977 C49 959 44 933 54 910Z" fill="#B9D8AF" />
          <path d="M68 968 L83 919 M78 946 L113 913 M83 954 L121 946" stroke="#4B946B" strokeWidth="7" strokeLinecap="round" />
          <path d="M648 1360 C682 1335 718 1341 731 1377 C697 1380 672 1397 662 1427 C643 1409 638 1383 648 1360Z" fill="#B9D8AF" />
          <path d="M662 1418 L677 1370 M672 1396 L707 1363 M677 1404 L715 1396" stroke="#4B946B" strokeWidth="7" strokeLinecap="round" />
        </g>

        <RoadBranch d="M535 258 C665 246 724 174 845 125" />
        <RoadBranch d="M259 520 C147 504 70 460 -45 390" />
        <RoadBranch d="M545 850 C668 831 745 775 852 708" />
        <RoadBranch d="M254 1150 C135 1138 63 1084 -42 1015" />

        <path d={MAIN_ROAD} fill="none" stroke="#D8D5CF" strokeWidth="226" strokeLinecap="round" />
        <path d={MAIN_ROAD} fill="none" stroke="#4D5055" strokeWidth="202" strokeLinecap="round" />
        <path
          className="gift-road-centerline"
          d={MAIN_ROAD}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="8"
          strokeDasharray="30 31"
          strokeLinecap="round"
        />

        <g transform="translate(635 115) rotate(-22)">
          <g className="gift-vehicle gift-vehicle-bus">
            <ellipse cx="0" cy="30" rx="72" ry="16" fill="#35383D" opacity=".2" />
            <rect x="-66" y="-25" width="132" height="58" rx="15" fill="#F0BD32" />
            <rect x="-50" y="-14" width="27" height="23" rx="4" fill="#D8F0F4" />
            <rect x="-15" y="-14" width="27" height="23" rx="4" fill="#D8F0F4" />
            <rect x="20" y="-14" width="29" height="23" rx="4" fill="#D8F0F4" />
            <circle cx="-42" cy="32" r="13" fill="#25272B" /><circle cx="42" cy="32" r="13" fill="#25272B" />
            <circle cx="-42" cy="32" r="5" fill="#D8D5CF" /><circle cx="42" cy="32" r="5" fill="#D8D5CF" />
            <path d="M-69 -3 L-82 4 L-69 12" fill="#F0BD32" />
          </g>
        </g>

        <g transform="translate(137 452) rotate(27)">
          <g className="gift-vehicle gift-vehicle-blue">
            <ellipse cx="0" cy="24" rx="54" ry="13" fill="#35383D" opacity=".2" />
            <path d="M-50 17 L-45 -11 L-20 -29 L24 -29 L47 -8 L52 18Z" fill="#91C9D7" />
            <path d="M-17 -23 L18 -23 L34 -7 L-33 -7Z" fill="#E6F5F7" />
            <circle cx="-30" cy="19" r="11" fill="#25272B" /><circle cx="31" cy="19" r="11" fill="#25272B" />
            <circle cx="-30" cy="19" r="4" fill="#D8D5CF" /><circle cx="31" cy="19" r="4" fill="#D8D5CF" />
          </g>
        </g>

        <g transform="translate(659 790) rotate(-24)">
          <g className="gift-vehicle gift-vehicle-yellow">
            <ellipse cx="0" cy="23" rx="51" ry="12" fill="#35383D" opacity=".2" />
            <path d="M-48 17 L-43 -7 L-19 -26 L20 -26 L45 -7 L49 18Z" fill="#F6C83F" />
            <path d="M-16 -20 L16 -20 L31 -6 L-31 -6Z" fill="#E8F4F4" />
            <circle cx="-28" cy="19" r="10" fill="#25272B" /><circle cx="29" cy="19" r="10" fill="#25272B" />
            <circle cx="-28" cy="19" r="4" fill="#D8D5CF" /><circle cx="29" cy="19" r="4" fill="#D8D5CF" />
          </g>
        </g>

        <g transform="translate(142 1080) rotate(26)">
          <g className="gift-vehicle gift-vehicle-van">
            <ellipse cx="0" cy="29" rx="61" ry="14" fill="#35383D" opacity=".2" />
            <path d="M-61 -25 H22 L57 -2 V29 H-61Z" fill="#132654" />
            <path d="M25 -17 L48 0 H25Z" fill="#D8F0F4" />
            <rect x="-42" y="-10" width="39" height="27" rx="5" fill="#FFFFFF" />
            <path d="M-29 -2 H-15 M-22 -9 V6" stroke="#D49A00" strokeWidth="5" strokeLinecap="round" />
            <circle cx="-34" cy="29" r="12" fill="#25272B" /><circle cx="34" cy="29" r="12" fill="#25272B" />
            <circle cx="-34" cy="29" r="5" fill="#D8D5CF" /><circle cx="34" cy="29" r="5" fill="#D8D5CF" />
          </g>
        </g>

        <RoadSign x={100} y={225} label="+1" color="#F0BD32" />
        <RoadSign x={684} y={590} label="+1" color="#8FC9D7" />
        <RoadSign x={112} y={806} label="C" color="#132654" />
        <RoadSign x={674} y={1182} label="+1" color="#F0BD32" />
      </svg>

      <div className="gift-road-start">Départ · cycle {cycle}</div>
      {items.map(({ paymentNumber, reward, state, position }, index) => (
        <motion.article
          key={paymentNumber}
          className={`gift-road-node gift-road-node-${state} ${reward ? "gift-road-node-reward" : "gift-road-node-payment"}`}
          style={{ left: `${position.left}%`, top: `${position.top}%` }}
          initial={{ opacity: 0, y: 22, scale: 0.92 }}
          animate={{ opacity: 1, y: state === "next" ? [0, -6, 0] : 0, scale: 1 }}
          transition={{
            opacity: { delay: index * 0.06, duration: 0.42 },
            scale: { delay: index * 0.06, duration: 0.42 },
            y: state === "next"
              ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
              : { delay: index * 0.06, duration: 0.42 },
          }}
        >
          <span className="gift-node-orb">
            {reward
              ? <Gift aria-hidden />
              : state === "done"
                ? <Check aria-hidden />
                : state === "locked"
                  ? <LockKeyhole aria-hidden />
                  : <Sparkles aria-hidden />}
          </span>
          <span className="gift-node-copy">
            <strong>{reward ? `Cadeau -${reward.discountRate} %` : `Paiement ${paymentNumber}`}</strong>
            <small>{reward ? `Débloqué au paiement ${paymentNumber} · ${reward.validityDays} jours` : state === "done" ? "Paiement validé" : "Prochaine étape sur la route"}</small>
          </span>
          {(state === "next" || (reward && state === "done")) && <Sparkles className="gift-node-sparkle" aria-hidden />}
        </motion.article>
      ))}

      <motion.div
        className="gift-road-future"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2.8, repeat: Infinity }}
      >
        <Gift aria-hidden />
        <span>{cycleEnabled ? "La route continue" : "De nouvelles surprises arrivent"}</span>
      </motion.div>

      <style jsx global>{`
        .gift-road-stage { position:relative; min-height:1780px; overflow:hidden; border:1px solid #d8d5cf; border-radius:30px; background:#f3f2ef; isolation:isolate; box-shadow:0 22px 55px rgba(17,27,77,.1); }
        .gift-road-title { position:absolute; z-index:5; top:1.1rem; right:1rem; max-width:148px; border:1px solid #d8d5cf; border-radius:16px; background:#fff; padding:.65rem .75rem; box-shadow:0 8px 0 #d8d5cf; text-align:left; }
        .gift-road-title span,.gift-road-title strong { display:block; }.gift-road-title span { color:#b47c00; font-size:.58rem; font-weight:950; letter-spacing:.12em; text-transform:uppercase; }.gift-road-title strong { margin-top:.15rem; color:#111827; font-size:.75rem; line-height:1.15; }
        .gift-road-svg { position:absolute; inset:0; width:100%; height:100%; }
        .gift-road-centerline { animation:road-flow 2.6s linear infinite; }
        .gift-vehicle { animation:vehicle-float 2.2s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
        .gift-vehicle-blue { animation-delay:-.6s; }.gift-vehicle-yellow { animation-delay:-1.1s; }.gift-vehicle-van { animation-delay:-1.6s; }
        .gift-road-start { position:absolute; z-index:6; left:1rem; top:1.1rem; border:1px solid #d8d5cf; border-radius:999px; background:#fff; color:#132654; padding:.55rem .8rem; font-size:.62rem; font-weight:950; text-transform:uppercase; letter-spacing:.08em; box-shadow:0 6px 0 #d8d5cf; }
        .gift-road-node { position:absolute; z-index:7; display:flex; align-items:center; gap:.48rem; width:min(178px,45vw); translate:-50% -50%; border:1px solid #d2d4d8; border-radius:16px; background:#fff; padding:.5rem; box-shadow:0 8px 0 rgba(77,80,85,.18),0 14px 28px rgba(17,24,39,.13); }
        .gift-road-node-payment { width:min(150px,40vw); border-radius:13px; padding:.4rem; }
        .gift-road-node-reward { width:min(195px,48vw); border-color:#d49a00; box-shadow:0 8px 0 #e7c667,0 17px 34px rgba(154,105,0,.21); }
        .gift-road-node-reward .gift-node-orb { background:#d49a00; animation:gift-bounce 1.9s ease-in-out infinite; }
        .gift-node-orb { display:flex; width:40px; height:40px; flex:none; align-items:center; justify-content:center; border-radius:12px; background:#132654; color:#fff; box-shadow:inset 0 -4px 0 rgba(0,0,0,.15); }
        .gift-node-orb :global(svg) { width:19px; height:19px; }.gift-node-copy { min-width:0; display:block; }.gift-node-copy strong,.gift-node-copy small { display:block; }.gift-node-copy strong { color:#111827; font-size:.75rem; line-height:1.15; }.gift-node-copy small { margin-top:.16rem; color:#4b5563; font-size:.63rem; font-weight:800; line-height:1.25; }
        .gift-road-node-done { border-color:#8cccb0; }.gift-road-node-done .gift-node-orb { background:#13795b; }
        .gift-road-node-next { border-color:#d49a00; box-shadow:0 8px 0 #e7c667,0 17px 34px rgba(154,105,0,.21); }.gift-road-node-next .gift-node-orb { background:#d49a00; }
        .gift-road-node-locked { opacity:.9; }.gift-road-node-locked .gift-node-orb { background:#e5e7eb; color:#5b6470; box-shadow:inset 0 -4px 0 #cbd0d7; }
        .gift-node-sparkle { position:absolute; width:18px; right:-7px; top:-8px; color:#b47c00; }
        .gift-road-future { position:absolute; z-index:7; left:50%; bottom:1.15rem; translate:-50% 0; display:flex; align-items:center; gap:.4rem; border:1px solid #d49a00; border-radius:999px; background:#fff; color:#6b4f00; padding:.48rem .72rem; box-shadow:0 6px 0 #e7c667; font-size:.63rem; font-weight:900; white-space:nowrap; }
        .gift-road-future :global(svg) { width:15px; height:15px; }
        @keyframes road-flow { to { stroke-dashoffset:-61; } }
        @keyframes vehicle-float { 0%,100% { translate:0 0; } 50% { translate:0 -5px; } }
        @keyframes gift-bounce { 0%,100% { transform:translateY(0) rotate(-3deg); } 50% { transform:translateY(-6px) rotate(3deg); } }
        @media (min-width:720px) { .gift-road-stage { min-height:1980px; }.gift-road-node { width:220px; padding:.68rem; gap:.65rem; }.gift-road-node-payment { width:176px; }.gift-road-node-reward { width:242px; }.gift-node-orb { width:48px; height:48px; }.gift-node-copy strong { font-size:.88rem; }.gift-node-copy small { font-size:.73rem; }.gift-road-title { max-width:190px; padding:.8rem 1rem; }.gift-road-title strong { font-size:.9rem; } }
        @media (prefers-reduced-motion:reduce) { .gift-road-centerline,.gift-vehicle,.gift-road-node-reward .gift-node-orb { animation:none!important; } }
      `}</style>
    </section>
  );
}

function RoadBranch({ d }: { d: string }) {
  return (
    <g>
      <path d={d} fill="none" stroke="#D8D5CF" strokeWidth="150" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#4D5055" strokeWidth="130" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#FFFFFF" strokeWidth="7" strokeDasharray="27 29" strokeLinecap="round" />
    </g>
  );
}

function RoadSign({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="70" rx="32" ry="9" fill="#35383D" opacity=".16" />
      <path d="M0 0 V68" stroke="#52555A" strokeWidth="8" strokeLinecap="round" />
      <rect x="-30" y="-20" width="60" height="49" rx="8" fill="#FFFFFF" stroke={color} strokeWidth="7" />
      <text x="0" y="12" textAnchor="middle" fill="#132654" fontSize="24" fontWeight="900">{label}</text>
    </g>
  );
}
