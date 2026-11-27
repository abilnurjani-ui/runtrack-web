import React from 'react';

export default function SsoLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-16 h-16' : 'w-11 h-11';
  return (
    <div className={`${dims} rounded-full bg-black border-2 border-zinc-200 flex items-center justify-center shadow-md shrink-0 overflow-hidden`}>
      <svg viewBox="0 0 160 56" className="w-[86%] h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* S pertama - tajam miring aerodinamis */}
        <path
          d="M14 39C23 44 43 43 48 35C52 28 31 27 35 20C39 14 55 13 64 17L59 22C51 19 43 19 41 22C39 25 57 26 53 36C48 46 24 48 10 42L14 39Z"
          fill="#FFFFFF"
        />
        {/* S kedua */}
        <path
          d="M58 39C67 44 87 43 92 35C96 28 75 27 79 20C83 14 99 13 108 17L103 22C95 19 87 19 85 22C83 25 101 26 97 36C92 46 68 48 54 42L58 39Z"
          fill="#FFFFFF"
        />
        {/* O oval miring */}
        <path
          d="M132 14C146 14 154 21 151 31C148 41 134 46 120 46C106 46 98 39 101 29C104 19 118 14 132 14ZM129 20C120 20 112 24 110 30C108 36 113 40 122 40C131 40 139 36 141 30C143 24 138 20 129 20Z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}
