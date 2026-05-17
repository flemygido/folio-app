"use client";

/**
 * Animated SVG Assistant Avatar
 *
 * States: idle | alert | thinking | greeting
 * Styles: PROFESSIONAL | FRIENDLY | MINIMAL
 * Gender: FEMALE | MALE | NEUTRAL
 */

export type AvatarState = "idle" | "alert" | "thinking" | "greeting";

interface AvatarProps {
  style: "PROFESSIONAL" | "FRIENDLY" | "MINIMAL";
  gender: "FEMALE" | "MALE" | "NEUTRAL";
  color: string;
  state: AvatarState;
  size?: number;
  name: string;
}

export function AssistantAvatar({ style, gender, color, state, size = 48, name }: AvatarProps) {
  const initial = name.charAt(0).toUpperCase();

  if (style === "MINIMAL") {
    return <MinimalAvatar color={color} state={state} size={size} initial={initial} />;
  }
  if (style === "PROFESSIONAL") {
    return <ProfessionalAvatar color={color} state={state} size={size} gender={gender} />;
  }
  return <FriendlyAvatar color={color} state={state} size={size} gender={gender} />;
}

// ─── MINIMAL AVATAR ──────────────────────────────────────────────────────────

function MinimalAvatar({
  color,
  state,
  size,
  initial,
}: {
  color: string;
  state: AvatarState;
  size: number;
  initial: string;
}) {
  const animClass =
    state === "idle"
      ? "animate-float"
      : state === "alert"
      ? "animate-pulse-ring"
      : state === "thinking"
      ? "animate-spin-slow"
      : "animate-wave";

  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold select-none ${animClass}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}, ${color}aa)`,
        fontSize: size * 0.4,
        color: "#020b18",
        boxShadow: state === "alert" ? `0 0 0 4px ${color}44, 0 0 16px ${color}55` : `0 4px 14px ${color}33`,
      }}
    >
      {state === "thinking" ? (
        <ThinkingDots color="#020b18" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

// ─── PROFESSIONAL AVATAR ──────────────────────────────────────────────────────

function ProfessionalAvatar({
  color,
  state,
  size,
  gender,
}: {
  color: string;
  state: AvatarState;
  size: number;
  gender: string;
}) {
  const s = size;
  const isFemale = gender === "FEMALE";
  const hairColor = isFemale ? "#1a0a00" : "#2d1810";
  const skinColor = "#f4c2a1";
  const suitColor = isFemale ? color : "#1e293b";

  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: state === "alert" ? `drop-shadow(0 0 8px ${color})` : "none",
        animation:
          state === "idle"
            ? "floatY 3s ease-in-out infinite"
            : state === "greeting"
            ? "waveArm 0.6s ease-in-out 2"
            : "none",
      }}
    >
      {/* Circle background */}
      <circle cx="50" cy="50" r="48" fill={`${color}22`} stroke={`${color}55`} strokeWidth="2" />

      {/* Body / suit */}
      <ellipse cx="50" cy="82" rx="26" ry="16" fill={suitColor} />

      {/* Neck */}
      <rect x="44" y="62" width="12" height="10" rx="4" fill={skinColor} />

      {/* Head */}
      <ellipse cx="50" cy="50" rx="20" ry="22" fill={skinColor} />

      {/* Hair */}
      {isFemale ? (
        <>
          <ellipse cx="50" cy="34" rx="20" ry="8" fill={hairColor} />
          <ellipse cx="32" cy="52" rx="5" ry="14" fill={hairColor} />
          <ellipse cx="68" cy="52" rx="5" ry="14" fill={hairColor} />
        </>
      ) : (
        <ellipse cx="50" cy="34" rx="20" ry="8" fill={hairColor} />
      )}

      {/* Eyes */}
      <ellipse cx="43" cy="49" rx="3.5" ry="4" fill="#fff" />
      <ellipse cx="57" cy="49" rx="3.5" ry="4" fill="#fff" />
      <circle cx="43" cy="49" r="2" fill="#1a1a2e" />
      <circle cx="57" cy="49" r="2" fill="#1a1a2e" />
      {/* Eye shine */}
      <circle cx="44" cy="48" r="0.8" fill="#fff" />
      <circle cx="58" cy="48" r="0.8" fill="#fff" />

      {/* Expression */}
      {state === "thinking" ? (
        // Thinking face — slight frown
        <path d="M44 60 Q50 57 56 60" stroke="#c0856a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      ) : state === "alert" ? (
        // Alert — open mouth
        <ellipse cx="50" cy="61" rx="5" ry="3.5" fill="#c0856a" />
      ) : (
        // Happy / neutral smile
        <path d="M44 60 Q50 65 56 60" stroke="#c0856a" strokeWidth="2" strokeLinecap="round" fill="none" />
      )}

      {/* Collar */}
      <path d="M38 72 L50 78 L62 72" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* Thinking dots overlay */}
      {state === "thinking" && (
        <g>
          <circle cx="42" cy="26" r="2.5" fill={color} opacity="0.6">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1.2s" begin="0s" repeatCount="indefinite" />
          </circle>
          <circle cx="50" cy="22" r="2.5" fill={color} opacity="0.6">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
          </circle>
          <circle cx="58" cy="26" r="2.5" fill={color} opacity="0.6">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1.2s" begin="0.8s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* Alert badge */}
      {state === "alert" && (
        <circle cx="78" cy="22" r="10" fill="#ef4444">
          <animate attributeName="r" values="10;12;10" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

// ─── FRIENDLY AVATAR ─────────────────────────────────────────────────────────

function FriendlyAvatar({
  color,
  state,
  size,
  gender,
}: {
  color: string;
  state: AvatarState;
  size: number;
  gender: string;
}) {
  const s = size;
  const isFemale = gender === "FEMALE";

  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        animation: state === "idle" ? "floatY 3s ease-in-out infinite" : "none",
        filter: state === "alert" ? `drop-shadow(0 0 10px ${color})` : "none",
      }}
    >
      {/* Blob background */}
      <path
        d="M50 5 C75 5 95 25 95 50 C95 75 75 95 50 95 C25 95 5 75 5 50 C5 25 25 5 50 5Z"
        fill={`${color}33`}
        stroke={`${color}66`}
        strokeWidth="2"
      >
        {state === "idle" && (
          <animate
            attributeName="d"
            values="M50 5 C75 5 95 25 95 50 C95 75 75 95 50 95 C25 95 5 75 5 50 C5 25 25 5 50 5Z;
                    M50 8 C78 3 97 27 93 52 C89 77 72 98 48 94 C24 90 3 73 7 48 C11 23 22 13 50 8Z;
                    M50 5 C75 5 95 25 95 50 C95 75 75 95 50 95 C25 95 5 75 5 50 C5 25 25 5 50 5Z"
            dur="4s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Face */}
      <circle cx="50" cy="48" r="26" fill="#fde68a" />

      {/* Hair */}
      {isFemale ? (
        <>
          <ellipse cx="50" cy="30" rx="22" ry="9" fill="#92400e" />
          <ellipse cx="30" cy="50" rx="6" ry="15" fill="#92400e" />
          <ellipse cx="70" cy="50" rx="6" ry="15" fill="#92400e" />
        </>
      ) : (
        <ellipse cx="50" cy="29" rx="22" ry="9" fill="#78350f" />
      )}

      {/* Eyes */}
      <circle cx="42" cy="46" r="5" fill="#fff" />
      <circle cx="58" cy="46" r="5" fill="#fff" />
      <circle cx="42" cy="46" r="3" fill="#1c1917" />
      <circle cx="58" cy="46" r="3" fill="#1c1917" />
      <circle cx="43" cy="45" r="1" fill="#fff" />
      <circle cx="59" cy="45" r="1" fill="#fff" />

      {/* Eyebrows */}
      <path d="M37 40 Q42 38 47 40" stroke="#92400e" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M53 40 Q58 38 63 40" stroke="#92400e" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Smile */}
      {state === "thinking" ? (
        <path d="M42 58 Q50 54 58 58" stroke="#d97706" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ) : state === "alert" ? (
        <>
          <path d="M42 56 Q50 63 58 56" stroke="#d97706" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <ellipse cx="50" cy="59" rx="6" ry="4" fill="#fbbf24" />
        </>
      ) : (
        <path d="M42 57 Q50 64 58 57" stroke="#d97706" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}

      {/* Cheeks */}
      <circle cx="36" cy="55" r="5" fill="#fca5a5" opacity="0.5" />
      <circle cx="64" cy="55" r="5" fill="#fca5a5" opacity="0.5" />

      {/* Thinking dots */}
      {state === "thinking" && (
        <g transform="translate(50, 20)">
          <circle cx="-8" cy="0" r="2.5" fill={color}>
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" begin="0s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="-3" r="2.5" fill={color}>
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" begin="0.33s" repeatCount="indefinite" />
          </circle>
          <circle cx="8" cy="0" r="2.5" fill={color}>
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" begin="0.66s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
    </svg>
  );
}

// ─── THINKING DOTS ───────────────────────────────────────────────────────────

function ThinkingDots({ color }: { color: string }) {
  return (
    <div className="flex gap-0.5 items-center">
      {[0, 0.2, 0.4].map((delay) => (
        <div
          key={delay}
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ background: color, animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}
