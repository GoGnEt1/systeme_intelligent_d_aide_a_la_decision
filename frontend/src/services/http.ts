export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";
export function authHeaders(access: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${access}`,
  };
}
