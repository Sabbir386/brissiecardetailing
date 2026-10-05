"use client";

import Link from "next/link";
import { useId } from "react";

function LogoMark({ size }: { size: number }) {
  const raw = useId().replace(/:/g, "");
  const plate = `plate-${raw}`;
  const gold = `gold-${raw}`;
  const goldSoft = `goldsoft-${raw}`;
  const shine = `shine-${raw}`;
  const glow = `glow-${raw}`;
  const clip = `clip-${raw}`;
  const dropFill = `drop-${raw}`;

  return (
    <span className="logo-mark" style={{ width: size, height: size }}>
      <svg className="logo-svg" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        <defs>
          <radialGradient id={plate} cx="38%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#3a342c" />
            <stop offset="55%" stopColor="#161310" />
            <stop offset="100%" stopColor="#070706" />
          </radialGradient>
          <linearGradient id={gold} x1="8%" y1="0%" x2="92%" y2="100%">
            <stop offset="0%" stopColor="#FFF3C4" />
            <stop offset="28%" stopColor="#F0C45A" />
            <stop offset="62%" stopColor="#D4A017" />
            <stop offset="100%" stopColor="#8C6A0C" />
          </linearGradient>
          <linearGradient id={goldSoft} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#FFE9A8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#D4A017" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={dropFill} x1="30%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#FFF6D0" />
            <stop offset="40%" stopColor="#F0C45A" />
            <stop offset="100%" stopColor="#A57A10" />
          </linearGradient>
          <linearGradient id={shine} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id={clip}>
            <rect x="3" y="3" width="58" height="58" rx="17" />
          </clipPath>
        </defs>

        <rect x="2" y="2" width="60" height="60" rx="18" fill={`url(#${gold})`} />
        <rect x="4.6" y="4.6" width="54.8" height="54.8" rx="15.4" fill={`url(#${plate})`} />
        <rect x="6.4" y="6.4" width="51.2" height="51.2" rx="13.8" fill="none" stroke={`url(#${gold})`} strokeWidth="0.7" opacity="0.45" />
        <ellipse cx="24" cy="18" rx="16" ry="10" fill={`url(#${goldSoft})`} />

        <g filter={`url(#${glow})`}>
          <text
            x="32"
            y="46"
            textAnchor="middle"
            fill="#FFF6E6"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="36"
            fontWeight="700"
          >
            B
          </text>
        </g>
        <text
          x="32"
          y="46"
          textAnchor="middle"
          fill="none"
          stroke={`url(#${gold})`}
          strokeWidth="0.6"
          opacity="0.45"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="36"
          fontWeight="700"
        >
          B
        </text>
        <text
          className="logo-reflection"
          x="32"
          y="61"
          textAnchor="middle"
          fill="#FFF6E6"
          opacity="0.14"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="18"
          fontWeight="700"
          transform="scale(1, 0.35) translate(0, 128)"
        >
          B
        </text>

        <g className="logo-drop">
          <path d="M54.2 15.8c0-4-5.2-8-5.2-10.8 0 2.8-5.2 6.8-5.2 10.8 0 3.3 2.3 5.6 5.2 5.6s5.2-2.3 5.2-5.6z" fill={`url(#${dropFill})`} />
          <path d="M51.4 10.6c-1 1.4-1.9 3-1.9 4.8 0 1.4.5 2.7 1.4 3.6" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
          <circle cx="47.4" cy="13.2" r="1.2" fill="#fff" />
        </g>

        <path className="logo-spark" d="M14.5 18.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill={`url(#${gold})`} />
        <path className="logo-spark delay" d="M50.8 42.2l.45 1.2 1.2.45-1.2.45-.45 1.2-.45-1.2-1.2-.45 1.2-.45z" fill="#FFF3C4" />

        <g clipPath={`url(#${clip})`}>
          <rect className="logo-gleam" x="-20" y="0" width="18" height="64" fill={`url(#${shine})`} />
        </g>
      </svg>
    </span>
  );
}

export function BrandLogo({
  href = "/",
  size = 58,
  withName = true,
  stacked = false,
  name = "brissiecardetailing",
}: {
  href?: string | null;
  size?: number;
  withName?: boolean;
  stacked?: boolean;
  name?: string;
}) {
  const mark = (
    <span className={`brand${stacked ? " stacked" : ""}`}>
      <LogoMark size={size} />
      {withName ? (
        <span className="wordmark">
          <span className="wordmark-name">brissie</span>
          <span className="wordmark-tag">car detailing</span>
        </span>
      ) : null}
    </span>
  );
  if (!href) return mark;
  return (
    <Link href={href} className="brand-link" aria-label={name}>
      {mark}
    </Link>
  );
}
