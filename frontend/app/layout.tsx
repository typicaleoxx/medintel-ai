// this file is the root layout that wraps every page
// it injects the theme script before render to prevent a light flash on dark mode load

import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "MedIntel",
  description: "AI powered clinical documentation and patient interaction",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full dark">
      <head>
        {/* apply saved theme before the page renders so there is no flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark')})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#080810] dark:bg-[#080810] dark:text-white text-gray-900 bg-gray-50 transition-colors duration-200">
        {children}
      </body>
    </html>
  )
}
