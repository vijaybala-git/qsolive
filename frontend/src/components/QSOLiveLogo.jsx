// QSOLive animated wordmark (SVG)
// Usage: <QSOLiveLogo width={280} />

import React from 'react';

const css = `
  @keyframes wave-pulse {
    0%,100% { opacity:1; }
    50% { opacity:0.25; }
  }
  @keyframes dot-ping {
    0%,100% { r:6; opacity:1; }
    55% { r:11; opacity:0.15; }
  }
  @keyframes bolt-flicker {
    0%,100% { opacity:1; }
    50% { opacity:0.7; }
  }
  @keyframes tagline-in {
    from { opacity:0; transform:translateY(5px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .qso-wi  { animation: wave-pulse 1.8s ease-in-out infinite; }
  .qso-wo  { animation: wave-pulse 1.8s ease-in-out infinite 0.45s; }
  .qso-wi2 { animation: wave-pulse 1.8s ease-in-out infinite; }
  .qso-wo2 { animation: wave-pulse 1.8s ease-in-out infinite 0.45s; }
  .qso-dp  { animation: dot-ping 1.8s ease-in-out infinite; }
  .qso-bolt { animation: bolt-flicker 2.4s ease-in-out infinite; }
  .qso-tgl { animation: tagline-in 0.8s ease 0.4s both; }
`;

export default function QSOLiveLogo({ width = 680, variant = 'default' }) {
  const vw = 680;
  const vh = 200;
  const navy = variant === 'onDark' ? '#e8edf7' : '#1a2e5a';
  const orange = '#f97316';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${vw} ${vh}`}
      width={width}
      height={(width / vw) * vh}
      aria-label="QSO Live — QSO stream live!"
      role="img"
      style={{ overflow: 'visible', display: 'block' }}
    >
      <defs>
        <style>{css}</style>
      </defs>

      <text
        x="60"
        y="140"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="118"
        letterSpacing="-3"
        fill={navy}
      >
        QSO
      </text>

      <path
        className="qso-wi"
        d="M 388 83 A 17 17 0 0 1 388 113"
        fill="none"
        stroke={orange}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <path
        className="qso-wo"
        d="M 399 71 A 29 29 0 0 1 399 125"
        fill="none"
        stroke={orange}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <path
        className="qso-wi2"
        d="M 366 83 A 17 17 0 0 0 366 113"
        fill="none"
        stroke={orange}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <path
        className="qso-wo2"
        d="M 355 71 A 29 29 0 0 0 355 125"
        fill="none"
        stroke={orange}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <circle className="qso-dp" cx="377" cy="98" r="6" fill={orange} />

      <text
        x="412"
        y="140"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="400"
        fontSize="118"
        letterSpacing="-2"
        fill={navy}
      >
        Live
      </text>

      <g className="qso-bolt" transform="rotate(17, 283, 95)">
        <path
          d="M 277 28  L 263 92  L 274 92  L 259 162  L 292 88  L 280 88 Z"
          fill={orange}
        />
      </g>

      <text
        className="qso-tgl"
        x="360"
        y="184"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontSize="24"
        fill={navy}
        opacity="0.75"
      >
        QSO stream live!
      </text>
    </svg>
  );
}
