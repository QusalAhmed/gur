"use client";

import { useEffect, useId } from "react";
import { MotionValue, motion, useSpring, useTransform, useMotionValue } from "motion/react";
import { Transition } from "motion";
import useMeasure from "react-use-measure";

const TRANSITION: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 18,
  mass: 0.3,
};

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

function Digit({
  value,
  place,
  isBengali,
}: {
  value: number;
  place: number;
  isBengali?: boolean;
}) {
  const valueRoundedToPlace = Math.floor(value / place) % 10;
  const initial = useMotionValue(valueRoundedToPlace);
  const animatedValue = useSpring(initial, TRANSITION);

  useEffect(() => {
    initial.set(valueRoundedToPlace);
  }, [initial, valueRoundedToPlace]);

  return (
    <div className="relative inline-block w-[1ch] overflow-x-visible overflow-y-clip leading-none tabular-nums select-none">
      <div className="invisible pointer-events-none">{isBengali ? "০" : "0"}</div>
      {Array.from({ length: 10 }, (_, i) => (
        <Number key={i} mv={animatedValue} number={i} isBengali={isBengali} />
      ))}
    </div>
  );
}

function Number({
  mv,
  number,
  isBengali,
}: {
  mv: MotionValue<number>;
  number: number;
  isBengali?: boolean;
}) {
  const uniqueId = useId();
  const [ref, bounds] = useMeasure();

  const y = useTransform(mv, (latest) => {
    if (!bounds.height) return 0;
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset * bounds.height;

    if (offset > 5) {
      memo -= 10 * bounds.height;
    }

    return memo;
  });

  const displayChar = isBengali ? BN_DIGITS[number] : number;

  // Render hidden placeholder until bounds are measured
  if (!bounds.height) {
    return (
      <span ref={ref} className="invisible absolute select-none pointer-events-none">
        {displayChar}
      </span>
    );
  }

  return (
    <motion.span
      style={{ y }}
      layoutId={`${uniqueId}-${number}`}
      className="absolute inset-0 flex items-center justify-center select-none"
      transition={TRANSITION}
      ref={ref}
    >
      {displayChar}
    </motion.span>
  );
}

export type SlidingNumberProps = {
  value: number;
  padStart?: boolean;
  decimalSeparator?: string;
  className?: string;
  isBengali?: boolean;
};

export function SlidingNumber({
  value,
  padStart = false,
  decimalSeparator = ".",
  className = "",
  isBengali = false,
}: SlidingNumberProps) {
  const absValue = Math.abs(value);
  const [integerPart, decimalPart] = absValue.toString().split(".");
  const integerValue = parseInt(integerPart, 10) || 0;
  const paddedInteger = padStart && integerValue < 10 ? `0${integerPart}` : integerPart;
  const integerDigits = paddedInteger.split("");
  const integerPlaces = integerDigits.map((_, i) => Math.pow(10, integerDigits.length - i - 1));

  return (
    <div className={`inline-flex items-center leading-none ${className}`}>
      {value < 0 && "-"}
      {integerDigits.map((_, index) => (
        <Digit
          key={`pos-${integerPlaces[index]}`}
          value={integerValue}
          place={integerPlaces[index]}
          isBengali={isBengali}
        />
      ))}
      {decimalPart && (
        <>
          <span>{decimalSeparator}</span>
          {decimalPart.split("").map((_, index) => (
            <Digit
              key={`decimal-${index}`}
              value={parseInt(decimalPart, 10)}
              place={Math.pow(10, decimalPart.length - index - 1)}
              isBengali={isBengali}
            />
          ))}
        </>
      )}
    </div>
  );
}
