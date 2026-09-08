import React, { useEffect, useRef } from "react";

const DotPattern = ({
  spacing = 20,
  dotSize = 1.5,
  dotColor = "#30343d",
  glowColor = "#8579e5",
  radius = 260,
  strength = 2.8,
}) => {
  const canvasRef = useRef(null);

  const mouse = useRef({
    x: -1000,
    y: -1000,
  });

  const currentMouse = useRef({
    x: -1000,
    y: -1000,
  });

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    let width = 0;
    let height = 0;
    let animationFrame;

    /*
     * --------------------------------------------
     * RESIZE
     * --------------------------------------------
     */

    const resize = () => {
      const rect = canvas.getBoundingClientRect();

      const dpr = window.devicePixelRatio || 1;

      width = rect.width;
      height = rect.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /*
     * --------------------------------------------
     * MOUSE
     *
     * Listen on WINDOW instead of canvas.
     * This is important because your form is
     * above the canvas.
     * --------------------------------------------
     */

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();

      mouse.current.x = e.clientX - rect.left;
      mouse.current.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.current.x = -1000;
      mouse.current.y = -1000;
    };

    /*
     * --------------------------------------------
     * DRAW
     * --------------------------------------------
     */

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      /*
       * Smooth cursor
       */
      currentMouse.current.x +=
        (mouse.current.x - currentMouse.current.x) * 0.14;

      currentMouse.current.y +=
        (mouse.current.y - currentMouse.current.y) * 0.14;

      const mx = currentMouse.current.x;
      const my = currentMouse.current.y;

      /*
       * Grid
       */
      const cols = Math.ceil(width / spacing) + 2;
      const rows = Math.ceil(height / spacing) + 2;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const baseX = col * spacing;
          const baseY = row * spacing;

          const dx = baseX - mx;
          const dy = baseY - my;

          const distance = Math.sqrt(dx * dx + dy * dy);

          /*
           * ----------------------------------------
           * NORMAL DOT
           * ----------------------------------------
           */

          if (distance >= radius) {
            ctx.beginPath();

            ctx.arc(
              baseX,
              baseY,
              dotSize,
              0,
              Math.PI * 2
            );

            ctx.fillStyle = dotColor;
            ctx.fill();

            continue;
          }

          /*
           * ----------------------------------------
           * NORMALIZED DISTANCE
           *
           * 0 = cursor
           * 1 = edge
           * ----------------------------------------
           */

          const r = distance / radius;

          /*
           * ----------------------------------------
           * FISHEYE FUNCTION
           *
           * This is the actual distortion.
           *
           * Dots close to the cursor are compressed.
           * Dots farther away are pushed outward.
           * ----------------------------------------
           */

          const falloff = 1 - r;

          const distortion =
            1 +
            strength *
              Math.pow(falloff, 2);

          /*
           * Move the dot radially away from
           * the cursor.
           */

          const transformedX =
            mx + dx * distortion;

          const transformedY =
            my + dy * distortion;

          /*
           * ----------------------------------------
           * 3D HEIGHT
           * ----------------------------------------
           */

          const height =
            Math.pow(falloff, 1.5);

          /*
           * Center is compressed.
           *
           * Around the center dots become larger.
           */

          const centerCompression =
            Math.max(
              0.22,
              r + 0.15
            );

          const size =
            dotSize *
            (
              0.35 +
              centerCompression * 2.8
            );

          /*
           * ----------------------------------------
           * PURPLE INTENSITY
           * ----------------------------------------
           */

          const purple =
            Math.min(
              1,
              height * 1.4
            );

          /*
           * ----------------------------------------
           * 3D SHADOW
           * ----------------------------------------
           */

          if (height > 0.05) {
            const shadowOffset =
              height * 12;

            ctx.beginPath();

            ctx.ellipse(
              transformedX + shadowOffset,
              transformedY + shadowOffset,
              size * 1.5,
              size * 0.65,
              0,
              0,
              Math.PI * 2
            );

            ctx.fillStyle = `rgba(
              45,
              35,
              105,
              ${purple * 0.3}
            )`;

            ctx.fill();
          }

          /*
           * ----------------------------------------
           * GLOW
           * ----------------------------------------
           */

          if (height > 0.08) {
            const glowRadius =
              size * (5 + height * 5);

            const glow =
              ctx.createRadialGradient(
                transformedX,
                transformedY,
                0,
                transformedX,
                transformedY,
                glowRadius
              );

            glow.addColorStop(
              0,
              `rgba(133,121,229,${
                purple * 0.45
              })`
            );

            glow.addColorStop(
              0.3,
              `rgba(133,121,229,${
                purple * 0.15
              })`
            );

            glow.addColorStop(
              1,
              "rgba(133,121,229,0)"
            );

            ctx.beginPath();

            ctx.arc(
              transformedX,
              transformedY,
              glowRadius,
              0,
              Math.PI * 2
            );

            ctx.fillStyle = glow;

            ctx.fill();
          }

          /*
           * ----------------------------------------
           * 3D DOT
           * ----------------------------------------
           */

          const dotGradient =
            ctx.createRadialGradient(
              transformedX - size * 0.45,
              transformedY - size * 0.5,
              size * 0.05,

              transformedX,
              transformedY,
              size * 1.5
            );

          /*
           * Bright highlight
           */
          dotGradient.addColorStop(
            0,
            `rgba(
              255,
              255,
              255,
              ${0.25 + purple * 0.7}
            )`
          );

          /*
           * Purple
           */
          dotGradient.addColorStop(
            0.2,
            `rgba(
              133,
              121,
              229,
              ${0.4 + purple * 0.6}
            )`
          );

          dotGradient.addColorStop(
            0.55,
            `rgba(
              105,
              92,
              190,
              ${0.35 + purple * 0.6}
            )`
          );

          /*
           * Dark edge
           */
          dotGradient.addColorStop(
            1,
            `rgba(
              45,
              38,
              100,
              ${0.5 + purple * 0.5}
            )`
          );

          ctx.beginPath();

          ctx.arc(
            transformedX,
            transformedY,
            size,
            0,
            Math.PI * 2
          );

          ctx.fillStyle = dotGradient;

          ctx.fill();

          /*
           * ----------------------------------------
           * SPECULAR HIGHLIGHT
           * ----------------------------------------
           */

          if (height > 0.25) {
            ctx.beginPath();

            ctx.arc(
              transformedX - size * 0.35,
              transformedY - size * 0.4,
              size * 0.18,
              0,
              Math.PI * 2
            );

            ctx.fillStyle = `rgba(
              255,
              255,
              255,
              ${height * 0.8}
            )`;

            ctx.fill();
          }
        }
      }

      animationFrame =
        requestAnimationFrame(draw);
    };

    resize();

    window.addEventListener(
      "resize",
      resize
    );

    /*
     * IMPORTANT:
     * Listen to the entire window.
     */
    window.addEventListener(
      "mousemove",
      handleMouseMove
    );

    window.addEventListener(
      "mouseleave",
      handleMouseLeave
    );

    draw();

    return () => {
      window.removeEventListener(
        "resize",
        resize
      );

      window.removeEventListener(
        "mousemove",
        handleMouseMove
      );

      window.removeEventListener(
        "mouseleave",
        handleMouseLeave
      );

      cancelAnimationFrame(
        animationFrame
      );
    };
  }, [
    spacing,
    dotSize,
    dotColor,
    glowColor,
    radius,
    strength,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
};

export default DotPattern;