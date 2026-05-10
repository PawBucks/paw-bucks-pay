import React from "react";

export const Paw: React.FC<{ size?: number; color?: string; opacity?: number; style?: React.CSSProperties }> = ({
  size = 64,
  color = "currentColor",
  opacity = 1,
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={{ opacity, ...style }} aria-hidden>
    <g fill={color}>
      <ellipse cx="14" cy="22" rx="6" ry="8" />
      <ellipse cx="50" cy="22" rx="6" ry="8" />
      <ellipse cx="24" cy="10" rx="5" ry="7" />
      <ellipse cx="40" cy="10" rx="5" ry="7" />
      <path d="M32 24c-9 0-16 7-16 15 0 6 5 10 10 10 3 0 4-2 6-2s3 2 6 2c5 0 10-4 10-10 0-8-7-15-16-15z" />
    </g>
  </svg>
);