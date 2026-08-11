import type { ReactNode } from "react";

/**
 * Paint the same chat blue before hydration so iOS Safari gaps
 * (status bar / home indicator) match the main surface.
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body {
              background: #0b1c2a !important;
              color-scheme: dark !important;
            }
          `,
        }}
      />
      {children}
    </>
  );
}
