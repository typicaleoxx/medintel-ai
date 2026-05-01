// this file configures tailwind to scan all app and component files for class names
import type { Config } from "tailwindcss";

const config: Config = {
  // tell tailwind which files to scan so unused styles get removed in production
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
