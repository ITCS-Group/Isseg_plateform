export function IssegLogo({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M36 4L8 16V38C8 53 20 64.5 36 68C52 64.5 64 53 64 38V16L36 4Z"
        fill="#F2A910"
        opacity="0.15"
        stroke="#F2A910"
        strokeWidth="2"
      />
      <path
        d="M36 10L14 20V38C14 50 24 59.5 36 62.5C48 59.5 58 50 58 38V20L36 10Z"
        fill="none"
        stroke="#F2A910"
        strokeWidth="1.5"
        opacity="0.6"
      />
      <rect x="23" y="32" width="26" height="3" rx="1" fill="#F2A910" />
      <polygon points="36,22 22,30 36,34 50,30" fill="#F2A910" />
      <rect x="46" y="30" width="2" height="8" rx="1" fill="#F2A910" />
      <circle cx="47" cy="39" r="2" fill="#F2A910" />
      <rect x="30" y="35" width="12" height="8" rx="1" fill="#F2A910" opacity="0.7" />
    </svg>
  );
}
