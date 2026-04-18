export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 512 512" style={{ flexShrink:0, display:"block" }}>
      <defs>
        <linearGradient id="lbg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E11D48"/>
          <stop offset="60%" stopColor="#2563EB"/>
          <stop offset="100%" stopColor="#0F2044"/>
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="512" height="512" rx="110" ry="110" fill="url(#lbg)"/>
      {/* Top glow */}
      <ellipse cx="200" cy="120" rx="220" ry="150" fill="rgba(255,255,255,0.08)"/>

      {/* Left partial card */}
      <rect x="22" y="145" width="163" height="222" rx="18" fill="rgba(255,255,255,0.18)"/>
      <rect x="44" y="176" width="80" height="11" rx="5.5" fill="rgba(255,255,255,0.46)"/>
      <rect x="44" y="196" width="60" height="8" rx="4" fill="rgba(255,255,255,0.28)"/>
      <rect x="44" y="211" width="72" height="8" rx="4" fill="rgba(255,255,255,0.22)"/>

      {/* Right partial card */}
      <rect x="327" y="145" width="163" height="222" rx="18" fill="rgba(255,255,255,0.18)"/>
      <rect x="349" y="176" width="80" height="11" rx="5.5" fill="rgba(255,255,255,0.46)"/>
      <rect x="349" y="196" width="60" height="8" rx="4" fill="rgba(255,255,255,0.28)"/>
      <rect x="349" y="211" width="72" height="8" rx="4" fill="rgba(255,255,255,0.22)"/>

      {/* Center main card */}
      <rect x="146" y="108" width="220" height="286" rx="24" fill="rgba(255,255,255,0.95)"/>
      {/* Title bar */}
      <rect x="170" y="145" width="130" height="15" rx="7.5" fill="rgba(100,40,200,0.5)"/>
      {/* Text lines */}
      <rect x="170" y="173" width="100" height="9" rx="4.5" fill="rgba(100,40,200,0.22)"/>
      <rect x="170" y="189" width="120" height="9" rx="4.5" fill="rgba(100,40,200,0.18)"/>
      <rect x="170" y="205" width="80" height="9" rx="4.5" fill="rgba(100,40,200,0.13)"/>
      {/* Image area */}
      <rect x="170" y="230" width="172" height="110" rx="14" fill="rgba(124,58,237,0.09)"/>
      <circle cx="256" cy="285" r="24" fill="rgba(124,58,237,0.14)"/>
      {/* Bottom text */}
      <rect x="170" y="358" width="172" height="9" rx="4.5" fill="rgba(100,40,200,0.1)"/>
      <rect x="170" y="373" width="115" height="9" rx="4.5" fill="rgba(100,40,200,0.07)"/>

      {/* Left arrow */}
      <circle cx="78" cy="252" r="26" fill="rgba(255,255,255,0.25)"/>
      <path d="M85 252 L71 252 M71 252 L78 244 M71 252 L78 260"
        stroke="rgba(255,255,255,0.9)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>

      {/* Right arrow */}
      <circle cx="434" cy="252" r="26" fill="rgba(255,255,255,0.25)"/>
      <path d="M427 252 L441 252 M441 252 L434 244 M441 252 L434 260"
        stroke="rgba(255,255,255,0.9)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>

      {/* Navigation dots */}
      <circle cx="229" cy="432" r="9" fill="rgba(255,255,255,0.92)"/>
      <circle cx="249" cy="432" r="5.5" fill="rgba(255,255,255,0.38)"/>
      <circle cx="266" cy="432" r="5.5" fill="rgba(255,255,255,0.38)"/>
      <circle cx="283" cy="432" r="5.5" fill="rgba(255,255,255,0.38)"/>
    </svg>
  );
}
