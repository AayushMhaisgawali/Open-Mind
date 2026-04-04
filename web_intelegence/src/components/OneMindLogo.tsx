import React from 'react';

interface OneMindLogoProps {
  className?: string;
  size?: number;
}

export function OneMindLogo({ className = '', size = 44 }: OneMindLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M39 103C23 103 13 91 13 75C13 62 21 51 33 47C36 29 51 18 68 18C80 18 91 22 99 31C111 34 120 45 120 59C120 68 117 76 111 82C111 95 102 103 89 103H75C76 109 82 117 88 122"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36 76C28 76 23 72 23 65C23 57 29 52 37 52C40 43 47 37 55 37C63 37 68 42 68 50C68 57 64 61 58 64C53 67 50 73 52 81"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M59 24C50 29 46 38 46 48C46 57 51 64 60 67C60 76 56 84 47 91"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M86 36C88 44 86 53 79 59C73 64 69 69 66 76"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M58 95C69 92 76 86 81 76C85 68 91 66 97 63C104 59 108 52 108 43"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M72 101C84 97 92 96 101 98"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
