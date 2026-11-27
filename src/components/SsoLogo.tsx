import React from 'react';

export default function SsoLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  return (
    <div className={`${dims} rounded-full bg-zinc-950 border-2 border-zinc-200 flex items-center justify-center shadow-sm shrink-0 overflow-hidden`}>
      <svg viewBox="0 0 120 44" className="w-[82%] h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 29C18 33 34 33 38 27C41 22 25 21 28 16C31 11 45 11 51 14"
          stroke="#FFFFFF"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <path
          d="M47 29C53 33 69 33 73 27C76 22 60 21 63 16C66 11 80 11 86 14"
          stroke="#FFFFFF"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <ellipse
          cx="98"
          cy="22"
          rx="14"
          ry="8.5"
          transform="rotate(-14 98 22)"
          stroke="#FFFFFF"
          strokeWidth="6.5"
        />
      </svg>
    </div>
  );
}
