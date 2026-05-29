// src/store/slices/images.ts
const MEDIA_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8000/api"
).replace(/\/api\/?$/, ""); // retire le /api final → "http://localhost:8000"

export function buildImageUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path; // déjà absolu
  return `${MEDIA_BASE}${path}`; // "/media/..." → "http://localhost:8000/media/..."
}
