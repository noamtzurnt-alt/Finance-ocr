import type { ReactNode } from "react";

/**
 * Paint the same chat surface before hydration so iOS Safari gaps
 * (status bar / home indicator) match the main surface.
 * Colors follow html[data-theme] tokens (green for Noam, pink for partner).
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body {
              background: var(--bg, #0b0b0b) !important;
              color: var(--foreground, #f4f4f4) !important;
              color-scheme: dark !important;
            }
          `,
        }}
      />
      {children}
    </>
  );
}
