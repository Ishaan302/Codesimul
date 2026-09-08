import React, { useRef, useState } from "react";

export const DotPattern = ({
  spacing = 24,
  dotSize = 1.5,
  dotColor = "#2d333b",
  glowColor = "#8579e5",
  glowRadius = 180,
}) => {
  const ref = useRef(null);
  const [mouse, setMouse] = useState({ x: -9999, y: -9999 });

  const handleMouseMove = (e) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();

    setMouse({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseLeave = () => {
    setMouse({
      x: -9999,
      y: -9999,
    });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="pointer-events-auto absolute inset-0 h-full w-full overflow-hidden"
      style={{
        backgroundImage: `radial-gradient(
          circle,
          ${dotColor} ${dotSize}px,
          transparent ${dotSize}px
        )`,
        backgroundSize: `${spacing}px ${spacing}px`,
      }}
    >
      {/* Cursor glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(
            circle,
            ${glowColor} 0px,
            ${glowColor}cc 2px,
            ${glowColor}66 4px,
            transparent 7px
          )`,
          backgroundSize: `${spacing}px ${spacing}px`,
          maskImage: `radial-gradient(
            circle ${glowRadius}px at ${mouse.x}px ${mouse.y}px,
            black,
            transparent
          )`,
          WebkitMaskImage: `radial-gradient(
            circle ${glowRadius}px at ${mouse.x}px ${mouse.y}px,
            black,
            transparent
          )`,
        }}
      />

      {/* Soft ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(
            circle ${glowRadius}px at ${mouse.x}px ${mouse.y}px,
            ${glowColor}12,
            transparent 70%
          )`,
        }}
      />
    </div>
  );
};

export default DotPattern;