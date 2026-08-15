import { useEffect, useRef } from "react";

// No official React wrapper is installed for this — a small script-loader + imperative render
// is simpler than adding a dependency for what's a handful of lines. window.turnstile is
// injected globally by the script this loads.
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load verification widget"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

interface Props {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire: () => void;
  // "interaction-only" (default) keeps the widget fully invisible for real users — it silently
  // passes in the background with no visible checkbox or checkmark, so nothing on screen could
  // be mistaken for "code sent" before the customer actually clicks Send. Cloudflare only shows
  // a visible challenge on the rare request its risk signals flag as needing one. The admin's
  // own test widget passes "always" instead, since seeing the checkmark there is the whole point.
  appearance?: "always" | "interaction-only";
}

// Mount a fresh instance (change `key` on this component) after every use — Turnstile tokens
// are single-use and expire after a few minutes, so send + resend both need a new challenge.
export function TurnstileWidget({ siteKey, onVerify, onExpire, appearance = "interaction-only" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: onVerify,
          "expired-callback": onExpire,
          appearance,
        });
      })
      .catch(() => {
        // Widget failed to load (network hiccup, ad-blocker) — the Send code button just stays
        // disabled since no token ever arrives; nothing more to do here.
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} />;
}
