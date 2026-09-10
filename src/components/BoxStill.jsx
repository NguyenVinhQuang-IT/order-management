export default function BoxStill() {
  return (
    <div className="hidden justify-center pb-2 tablet:flex" aria-hidden="true">
      <svg
        className="block h-auto w-[min(240px,42vw)] drop-shadow-[3px_5px_30px_rgba(0,0,0,0.22)]"
        viewBox="0 0 240 280"
        width="240"
        height="280"
      >
        <ellipse cx="120" cy="258" rx="74" ry="11" fill="rgba(0, 0, 0, 0.28)" />
        <path fill="#e8e8ed" d="M58 86 120 54l86 32v148l-86 28-62-28V86Z" />
        <path fill="#f5f5f7" d="M34 86 120 54l86 32v148L120 262 34 234V86Z" />
        <path fill="#ffffff" d="M34 86 120 118l86-32L120 54 34 86Z" />
        <path fill="#1d1d1f" d="M114 70v184h12V66Z" opacity="0.92" />
      </svg>
    </div>
  );
}
