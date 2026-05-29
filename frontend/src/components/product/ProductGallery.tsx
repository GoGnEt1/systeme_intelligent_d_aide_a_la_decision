import { useState, useRef, useEffect, useCallback } from "react";
import { buildImageUrl } from "../../store/slices/images";
import type { Product } from "../../types";
import { usePinch } from "@use-gesture/react";

interface Props {
  product: Product;
}

const ZOOM_FACTOR = 3.5;
const LENS_SIZE = 130;

export default function ProductGallery({ product }: Props) {
  const [activeImg, setActiveImg] = useState(0);
  const [showZoom, setShowZoom] = useState(false);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allImages = [
    ...(product?.image
      ? [{ id: 0, image: product.image, alt_text: product.name }]
      : []),
    ...(product?.images || []),
  ];

  const current = allImages[activeImg];
  const imageSrc = buildImageUrl(current?.image) ?? "";

  useEffect(() => {
    allImages.forEach((img) => {
      const i = new Image();
      i.src = buildImageUrl(img.image) ?? "";
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => setLoading(false);
  }, [imageSrc]);

  // Correct zoom position: full 0–100% coverage including edges
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Raw normalized [0,1] — no clamping to allow full-edge coverage
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Clamp to [0,1]
    setPos({
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    });
  }, []);

  const bind = usePinch(({ offset: [d] }) => {
    setScale(Math.min(Math.max(1, d / 200), 3));
  });

  return (
    <div ref={wrapperRef} className="relative flex gap-3">
      {/* Thumbnails verticaux (desktop) */}
      {allImages.length > 1 && (
        <div className="hidden md:flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
          {allImages.map((img, i) => (
            <button
              key={img.id}
              title={img.alt_text || `Image ${i + 1}`}
              onClick={() => setActiveImg(i)}
              onMouseEnter={() => setActiveImg(i)}
              className={`w-16 h-16 border-2 rounded overflow-hidden flex-shrink-0 transition-all ${
                i === activeImg
                  ? "border-orange-500 shadow-md"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <img
                src={buildImageUrl(img.image) ?? undefined}
                alt={img.alt_text || `Image ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col flex-1">
        {/* Image principale */}
        <div
          {...bind()}
          ref={containerRef}
          className="relative w-full md:w-[400px] h-[340px] md:h-[400px] bg-gray-50 border border-gray-100 rounded-lg overflow-hidden cursor-crosshair select-none"
          onMouseEnter={() => setShowZoom(true)}
          onMouseLeave={() => {
            setShowZoom(false);
          }}
          onMouseMove={handleMouseMove}
        >
          {loading ? (
            <div className="w-full h-full bg-gray-200 animate-pulse rounded-lg" />
          ) : (
            <img
              src={imageSrc}
              alt={current?.alt_text || product.name}
              className="w-full h-full object-contain"
              style={{ transform: `scale(${scale})` }}
              draggable={false}
            />
          )}

          {/* Lens indicator — clamped to stay fully inside container */}
          {showZoom &&
            !loading &&
            (() => {
              // The container for desktop is 400×400, lens is LENS_SIZE×LENS_SIZE
              // We compute pixel position and clamp so lens never goes outside
              const containerW = 400;
              const containerH = 400;
              const half = LENS_SIZE / 2;
              const lensX = Math.min(
                Math.max(pos.x * containerW, half),
                containerW - half,
              );
              const lensY = Math.min(
                Math.max(pos.y * containerH, half),
                containerH - half,
              );
              return (
                <div
                  className="absolute border-2 border-orange-400 bg-orange-100/20 pointer-events-none rounded-sm"
                  style={{
                    width: LENS_SIZE,
                    height: LENS_SIZE,
                    left: lensX,
                    top: lensY,
                    transform: "translate(-50%, -50%)",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.03)",
                  }}
                />
              );
            })()}
        </div>

        {/* Thumbnails horizontaux (mobile) */}
        {allImages.length > 1 && (
          <div className="flex md:hidden gap-2 mt-3 overflow-x-auto pb-1">
            {allImages.map((img, i) => (
              <button
                key={img.id}
                title={img.alt_text || `Image ${i + 1}`}
                onClick={() => setActiveImg(i)}
                className={`w-14 h-14 border-2 rounded flex-shrink-0 overflow-hidden ${
                  i === activeImg ? "border-orange-500" : "border-gray-200"
                }`}
              >
                <img
                  src={buildImageUrl(img.image) ?? undefined}
                  alt={img.alt_text || `Image ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zoom panel — pleine couverture de l'image */}
      {showZoom && imageSrc && !loading && (
        <div
          className="hidden lg:block absolute pointer-events-none"
          style={{
            left: "calc(100% + 16px)",
            top: 0,
            width: 460,
            height: 460,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
            backgroundImage: `url(${imageSrc})`,
            backgroundRepeat: "no-repeat",
            // backgroundSize covers the full panel at zoom factor
            backgroundSize: `${ZOOM_FACTOR * 100}%`,
            // CSS background-position X% aligns the X% point of the image to the X% point of the element.
            // This naturally gives full edge coverage: at pos=0 → leftmost edge shown; pos=1 → rightmost edge shown.
            backgroundPosition: `${pos.x * 100}% ${pos.y * 100}%`,
            transition: "background-position 0.04s linear",
            zIndex: 50,
            boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          }}
        />
      )}
    </div>
  );
}
