import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Status (semantic)
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          container: "hsl(var(--success-container))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          container: "hsl(var(--warning-container))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          container: "hsl(var(--info-container))",
        },
        // Surface containers (M3-style)
        surface: "hsl(var(--surface))",
        "surface-container-low": "hsl(var(--surface-container-low))",
        "surface-container": "hsl(var(--surface-container))",
        "surface-container-high": "hsl(var(--surface-container-high))",
        "surface-container-highest": "hsl(var(--surface-container-highest))",
        // Primary container
        "primary-container": "hsl(var(--primary-container))",
        "on-primary-container": "hsl(var(--on-primary-container))",
        // Channel brand colors (use sparingly — badges/icons only)
        "channel-whatsapp": "hsl(var(--channel-whatsapp))",
        "channel-whatsapp-bg": "hsl(var(--channel-whatsapp-bg))",
        "channel-facebook": "hsl(var(--channel-facebook))",
        "channel-facebook-bg": "hsl(var(--channel-facebook-bg))",
        "channel-instagram": "hsl(var(--channel-instagram))",
        "channel-instagram-bg": "hsl(var(--channel-instagram-bg))",
        // Conversation status
        "status-open": "hsl(var(--status-open))",
        "status-open-bg": "hsl(var(--status-open-bg))",
        "status-pending": "hsl(var(--status-pending))",
        "status-pending-bg": "hsl(var(--status-pending-bg))",
        "status-closed": "hsl(var(--status-closed))",
        "status-closed-bg": "hsl(var(--status-closed-bg))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        // See tokens.json. These are the Tailwind-side aliases for shadcn defaults.
        "display-lg": ["36px", { lineHeight: "44px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "headline-lg": ["24px", { lineHeight: "32px", fontWeight: "600", letterSpacing: "-0.015em" }],
        "headline-md": ["20px", { lineHeight: "28px", fontWeight: "600", letterSpacing: "-0.01em" }],
        "headline-sm": ["16px", { lineHeight: "22px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px" }],
        "body-sm": ["13px", { lineHeight: "18px" }],
        "label-md": ["12px", { lineHeight: "16px", fontWeight: "500", letterSpacing: "0.01em" }],
        "label-sm": ["11px", { lineHeight: "14px", fontWeight: "600", letterSpacing: "0.04em" }],
      },
    },
  },
  plugins: [],
};

export default config;