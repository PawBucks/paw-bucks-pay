import React from "react";
import { PawBucksLogo } from "@/components/PawBucksLogo";

interface PawBucksLogoProps {
  className?: string;
  size?: number;
}

export const PawBucksLogo: React.FC<PawBucksLogoProps> = ({
  className = "",
  size,
}) => {
  if (size) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className={className}
        aria-hidden="true"
      >
        <g fill="currentColor">
          <ellipse cx="14" cy="22" rx="6" ry="8" />
          <ellipse cx="50" cy="22" rx="6" ry="8" />
          <ellipse cx="24" cy="10" rx="5" ry="7" />
          <ellipse cx="40" cy="10" rx="5" ry="7" />
          <path d="M32 24c-9 0-16 7-16 15 0 6 5 10 10 10 3 0 4-2 6-2s3 2 6 2c5 0 10-4 10-10 0-8-7-15-16-15z" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <g fill="currentColor">
        <ellipse cx="14" cy="22" rx="6" ry="8" />
        <ellipse cx="50" cy="22" rx="6" ry="8" />
        <ellipse cx="24" cy="10" rx="5" ry="7" />
        <ellipse cx="40" cy="10" rx="5" ry="7" />
        <path d="M32 24c-9 0-16 7-16 15 0 6 5 10 10 10 3 0 4-2 6-2s3 2 6 2c5 0 10-4 10-10 0-8-7-15-16-15z" />
      </g>
    </svg>
  );
};
