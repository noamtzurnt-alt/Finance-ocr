import type { ReactNode } from "react";

/**
 * Paint dark chrome before hydration so iOS Safari never flashes white
 * status/safe areas on /chat.
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body {
              background: #061018 !important;
              color-scheme: dark !important;
            }
          `,
        }}
      />
      {children}
    </>
  );
}
