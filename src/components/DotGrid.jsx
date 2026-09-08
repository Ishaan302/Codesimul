import { useRef, useEffect, useMemo } from "react";
import { gsap } from "gsap";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import "./DotGrid.css";

gsap.registerPlugin(InertiaPlugin);

const DotGrid = ({
    dotSize = 5,
    gap = 17,
    baseColor = "#292929",
    activeColor = "#FF6B35",
    proximity = 120,
    shockRadius = 260,
    shockStrength = 11,
    resistance = 1650,
    returnDuration = 2.1,
    className = "",
}) => {
    const canvasRef = useRef(null);
    const wrapperRef = useRef(null);

    const baseRgb = useMemo(() => {
        const hex = baseColor.replace("#", "");

        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16),
        };
    }, [baseColor]);

    const activeRgb = useMemo(() => {
        const hex = activeColor.replace("#", "");

        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16),
        };
    }, [activeColor]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const wrapper = wrapperRef.current;

        if (!canvas || !wrapper) return;

        const ctx = canvas.getContext("2d");

        let width = 0;
        let height = 0;
        let dots = [];
        let animationFrame;

        const mouse = {
            x: -9999,
            y: -9999,
            vx: 0,
            vy: 0,
            lastX: -9999,
            lastY: -9999,
        };

        const resize = () => {
            const rect = wrapper.getBoundingClientRect();

            width = rect.width;
            height = rect.height;

            const dpr = window.devicePixelRatio || 1;

            canvas.width = width * dpr;
            canvas.height = height * dpr;

            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            dots = [];

            for (let y = gap / 2; y < height; y += gap) {
                for (let x = gap / 2; x < width; x += gap) {
                    dots.push({
                        cx: x,
                        cy: y,
                        xOffset: 0,
                        yOffset: 0,
                        _inertiaApplied: false,
                    });
                }
            }
        };

        resize();

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(wrapper);

        const handleMouseMove = (event) => {
            if (!wrapperRef.current) return;

            const rect =
                wrapperRef.current.getBoundingClientRect();

            const x =
                event.clientX - rect.left;

            const y =
                event.clientY - rect.top;

            mouse.x = x;
            mouse.y = y;

            mouse.vx = x - mouse.lastX;
            mouse.vy = y - mouse.lastY;

            mouse.lastX = x;
            mouse.lastY = y;
        };

        const handleMouseLeave = () => {
            mouse.x = -9999;
            mouse.y = -9999;
            mouse.vx = 0;
            mouse.vy = 0;
        };

        const handleClick = (event) => {
            const rect = wrapper.getBoundingClientRect();

            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;

            dots.forEach((dot) => {
                const dx = dot.cx - clickX;
                const dy = dot.cy - clickY;

                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > shockRadius) return;

                const force =
                    (1 - distance / shockRadius) * shockStrength;

                const angle = Math.atan2(dy, dx);

                const targetX =
                    Math.cos(angle) * force * 10;

                const targetY =
                    Math.sin(angle) * force * 10;

                gsap.to(dot, {
                    xOffset: targetX,
                    yOffset: targetY,
                    duration: 0.25,
                    ease: "power2.out",
                    overwrite: true,
                });

                gsap.to(dot, {
                    xOffset: 0,
                    yOffset: 0,
                    duration: returnDuration,
                    delay: 0.15,
                    ease: "elastic.out(1, 0.5)",
                    overwrite: false,
                });
            });
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseleave", handleMouseLeave);
        window.addEventListener("click", handleClick);

        const animate = () => {
            ctx.clearRect(0, 0, width, height);

            dots.forEach((dot) => {
                const x = dot.cx + dot.xOffset;
                const y = dot.cy + dot.yOffset;

                const dx = mouse.x - x;
                const dy = mouse.y - y;

                const distance = Math.sqrt(dx * dx + dy * dy);

                let r = baseRgb.r;
                let g = baseRgb.g;
                let b = baseRgb.b;

                if (distance < proximity) {
                    const strength =
                        1 - distance / proximity;

                    r =
                        baseRgb.r +
                        (activeRgb.r - baseRgb.r) * strength;

                    g =
                        baseRgb.g +
                        (activeRgb.g - baseRgb.g) * strength;

                    b =
                        baseRgb.b +
                        (activeRgb.b - baseRgb.b) * strength;

                    /*
                     * Cursor movement pushes nearby dots.
                     */
                    if (
                        Math.abs(mouse.vx) > 0.1 ||
                        Math.abs(mouse.vy) > 0.1
                    ) {
                        const push =
                            strength *
                            Math.min(
                                Math.sqrt(
                                    mouse.vx * mouse.vx +
                                    mouse.vy * mouse.vy
                                ),
                                25
                            ) *
                            0.8;

                        const angle = Math.atan2(
                            mouse.vy,
                            mouse.vx
                        );

                        const targetX =
                            Math.cos(angle) * push;

                        const targetY =
                            Math.sin(angle) * push;

                        gsap.to(dot, {
                            xOffset: targetX,
                            yOffset: targetY,
                            duration: 0.25,
                            ease: "power2.out",
                            overwrite: true,
                        });

                        gsap.to(dot, {
                            xOffset: 0,
                            yOffset: 0,
                            duration: returnDuration,
                            delay: 0.1,
                            ease: "elastic.out(1, 0.5)",
                            overwrite: false,
                        });
                    }
                }

                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    dotSize / 2,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(
                    g
                )}, ${Math.round(b)})`;

                ctx.fill();
            });

            mouse.vx *= 0.9;
            mouse.vy *= 0.9;

            animationFrame = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationFrame);

            resizeObserver.disconnect();

            window.removeEventListener(
                "mousemove",
                handleMouseMove
            );

            window.removeEventListener(
                "mouseleave",
                handleMouseLeave
            );

            window.removeEventListener(
                "click",
                handleClick
            );

            gsap.killTweensOf(dots);
        };
    }, [
        dotSize,
        gap,
        proximity,
        shockRadius,
        shockStrength,
        resistance,
        returnDuration,
        baseRgb,
        activeRgb,
    ]);

    return (
        <div
            ref={wrapperRef}
            className={`dot-grid ${className}`}
        >
            <canvas
                ref={canvasRef}
                className="dot-grid__canvas"
            />
        </div>
    );
};

export default DotGrid;