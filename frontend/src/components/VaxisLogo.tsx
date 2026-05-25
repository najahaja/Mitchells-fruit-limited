import React from "react";
import mitchellsLogo from "../assets/images/mitchell's.png";

interface Props {
  height?: number;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function VaxisLogo({ height = 30, style, className }: Props) {
  return (
    <img
      src={mitchellsLogo}
      alt="Mitchell's Logo"
      style={{ height, display: "block", objectFit: "contain", ...style }}
      className={className}
    />
  );
}
