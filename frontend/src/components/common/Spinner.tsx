// src/components/common/Spinner.tsx
interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
}

export default function Spinner({
  size = "md",
  color = "border-gognet-orange",
}: SpinnerProps) {
  const sizeMap = { sm: "w-5 h-5", md: "w-10 h-10", lg: "w-14 h-14" };
  return (
    <div
      className={`${sizeMap[size]} ${color} border-4 border-t-transparent rounded-full animate-spin`}
    />
  );
}
