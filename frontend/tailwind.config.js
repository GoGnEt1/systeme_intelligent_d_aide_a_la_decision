/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette GoGnEt-inspired SmartShop
        gognet: {
          orange: "#FF9900",
          "orange-dark": "#E88B00",
          dark: "#131921",
          nav: "#232F3E",
          "nav-light": "#37475A",
          blue: "#007185",
          "blue-dark": "#005A6F",
          red: "#B12704",
          yellow: "#F7CA00",
          bg: "#EAEDED",
          green: "#007600",
          star: "#FFA41C",
          prime: "#00A8E1",
          gray: "#565959",
          // border: "#D5D9D9",

          border: "#E2E8F0",
          "border-dark": "#1E293B",
          indigo: "#4F46E5", // indigo vif — accent principal
          "indigo-dark": "#3730A3",
          "indigo-light": "#818CF8",
          teal: "#0D9488", // teal — accent secondaire
          "teal-dark": "#0F766E",
          "teal-light": "#2DD4BF",
          navy: "#0F172A", // sidebar / navbar
          "navy-mid": "#1E293B", // cartes
          // Textes
          text: "#0F172A",
          "text-muted": "#64748B",
          "text-light": "#F1F5F9",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
        },
      },
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        sans: ["'Outfit'", "Arial", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease-out forwards",
        "fade-in": "fadeIn 0.3s ease-out forwards",
        "slide-in": "slideIn 0.3s ease-out forwards",
        "bounce-sm": "bounceSm 2s infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        shimmer: "shimmer 1.6s infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideIn: {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        bounceSm: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      boxShadow: {
        product: "0 2px 8px rgba(0,0,0,0.12)",
        "product-hover": "0 6px 20px rgba(0,0,0,0.18)",
        card: "0 1px 3px rgba(0,0,0,0.10)",
      },
      backgroundImage: {
        "gognet-gradient": "linear-gradient(135deg, #4F46E5 0%, #0D9488 100%)",
        "gognet-dark": "linear-gradient(135deg, #0B1120 0%, #1E293B 100%)",
        "hero-pattern":
          "radial-gradient(circle at 20% 50%, rgba(79,70,229,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(13,148,136,0.15) 0%, transparent 50%)",
      },
    },
  },
  plugins: [],
};
