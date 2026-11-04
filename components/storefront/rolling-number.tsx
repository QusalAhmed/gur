"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { motion, animate } from "motion/react";

interface RollingNumberProps {
  /** The value string to animate, e.g. "২০+", "৫,০০০+", "১০০%", "৬৪", "20+", "5,000+" */
  value: string | number;
  /** Explicit control over active state (e.g. current full-screen snap section). Defaults to tracking in-view. */
  isActive?: boolean;
  /** Duration of the count-up in seconds. Auto-calibrated based on number magnitude if omitted. */
  duration?: number;
  /** Initial delay before count starts in seconds. Defaults to 0 */
  delay?: number;
  /** Additional CSS class names */
  className?: string;
}

const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const emptySubscribe = () => () => {};

/**
 * Parses numeric value, prefix, suffix, and language from strings like "২০+", "৫,০০০+", "১০০%", "64"
 */
function parseNumberString(str: string): {
  target: number;
  prefix: string;
  suffix: string;
  isBengali: boolean;
} {
  const isBengali = /[০-৯]/.test(str);
  let normalized = str;
  if (isBengali) {
    normalized = str.replace(/[০-৯]/g, (d) => String(BENGALI_DIGITS.indexOf(d)));
  }

  const match = normalized.match(/^([^\d]*)([\d,]+)(.*)$/);
  if (!match) {
    return { target: 0, prefix: "", suffix: "", isBengali };
  }

  const prefix = match[1] || "";
  const numStr = match[2].replace(/,/g, "");
  const suffix = match[3] || "";
  const target = parseInt(numStr, 10) || 0;

  return { target, prefix, suffix, isBengali };
}

/**
 * Formats a number with locale commas and converts to Bengali numerals if needed.
 */
function formatNumberWithCommas(num: number, isBengali: boolean): string {
  const enFormatted = num.toLocaleString("en-US");
  if (!isBengali) {
    return enFormatted;
  }
  return enFormatted.replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)]);
}

/**
 * Dynamic Count-Up Number Component.
 * First shows 0 (or "০+", "০%", "০") then visibly counts up to culmination
 * using Framer Motion with smooth ease-out and an accent celebration pulse.
 */
export function RollingNumber({
  value,
  isActive,
  duration,
  delay = 0,
  className = "",
}: RollingNumberProps) {
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const containerRef = useRef<HTMLSpanElement>(null);
  const [isInView, setIsInView] = useState(() => typeof IntersectionObserver === "undefined");
  const [currentValue, setCurrentValue] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const stringValue = String(value);
  const { target, prefix, suffix, isBengali } = parseNumberString(stringValue);

  // Initial zero display (e.g. "০+", "০%", "০")
  const zeroDisplay = `${prefix}${formatNumberWithCommas(0, isBengali)}${suffix}`;

  // Auto-calibrate duration if not provided
  const resolvedDuration =
    duration ?? (target >= 1000 ? 1.6 : target >= 100 ? 1.4 : target >= 50 ? 1.2 : 1.0);

  // IntersectionObserver fallback for standalone / non-snap environments
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsInView(true);
          } else if (isActive === undefined) {
            setIsInView(false);
          }
        }
      },
      { threshold: 0.15 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isActive]);

  const shouldAnimate = isActive !== undefined ? isActive : isInView;

  // Active Count-up Animation Loop powered by Framer Motion: starts strictly at 0 then counts to target
  useEffect(() => {
    if (!shouldAnimate || target <= 0) {
      return;
    }

    setCurrentValue(0);
    setIsComplete(false);

    const controls = animate(0, target, {
      duration: resolvedDuration,
      delay: delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        setCurrentValue(Math.round(latest));
      },
      onComplete: () => {
        setCurrentValue(target);
        setIsComplete(true);
      },
    });

    return () => controls.stop();
  }, [shouldAnimate, target, resolvedDuration, delay]);

  // SSR fallback: render 0 with prefix/suffix so the user sees 0 first before hydration/animation
  if (!isHydrated) {
    return (
      <span
        className={`inline-flex items-center align-middle font-mono font-black tabular-nums ${className}`}
        aria-label={stringValue}
      >
        <span className="sr-only">{stringValue}</span>
        <span aria-hidden="true">{zeroDisplay}</span>
      </span>
    );
  }

  const isCulminated = shouldAnimate && isComplete;
  const formattedDisplay = `${prefix}${formatNumberWithCommas(currentValue, isBengali)}${suffix}`;

  return (
    <span
      ref={containerRef}
      className={`inline-flex items-center align-middle font-mono font-black tabular-nums ${className}`}
      aria-label={stringValue}
    >
      <span className="sr-only">{stringValue}</span>
      <motion.span
        animate={{
          scale: isCulminated ? [1, 1.12, 1] : 1,
        }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="inline-block tabular-nums"
        aria-hidden="true"
      >
        {formattedDisplay}
      </motion.span>
    </span>
  );
}

export default RollingNumber;
