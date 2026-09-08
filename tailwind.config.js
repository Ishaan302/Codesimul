/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "cell-ripple": {
          "0%": { opacity: 0.4, transform: "scale(1)" },
          "50%": { opacity: 1, transform: "scale(1.15)" },
          "100%": { opacity: 0.4, transform: "scale(1)" },
        },
      },
      animation: {
        "cell-ripple": "cell-ripple var(--duration, 400ms) ease-out var(--delay, 0ms)",
      },
    },
  },
  plugins: [],
};
