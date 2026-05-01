// this file configures tailwind to scan all app and component files for class names
import type { Config } from "tailwindcss";

const config: Config = {
  // use class based dark mode so we can toggle it with javascript
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
