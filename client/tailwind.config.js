/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "app-bg": "var(--bg-app)",
        "app-card": "var(--bg-card)",
        "app-card-hover": "var(--bg-card-hover)",
        "app-border": "var(--border-app)",
        "app-text": "var(--text-primary)",
        "app-dim": "var(--text-dim)",
        "app-accent": "var(--accent)",
        "app-danger": "var(--danger)",
      },
    },
  },
  plugins: [],
};
