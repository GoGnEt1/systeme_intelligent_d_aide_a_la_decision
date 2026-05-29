// src/components/common/Stars.tsx
interface StarsProps {
  rating: number;
  size?: "sm" | "md" | "lg";
}

export default function Stars({ rating, size = "sm" }: StarsProps) {
  const sizeClass = { sm: "text-[16px]", md: "text-[19px]", lg: "text-[23px]" }[
    size
  ];
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);

  return (
    <span
      className={`inline-flex items-center ${sizeClass} leading-none`}
      aria-label={`Note: ${rating}/5`}
    >
      {Array.from({ length: full }).map((_, i) => (
        <span key={`f${i}`} className="text-gognet-orange">
          ★
        </span>
      ))}
      {half && (
        <span
          className={`text-gognet-orange`}
          style={{ filter: "contrast(0.5)" }}
        >
          ★
        </span>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e${i}`} className="text-gray-300">
          ★
        </span>
      ))}
    </span>
  );
}
