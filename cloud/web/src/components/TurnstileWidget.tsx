import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

const TURNSTILE_SCRIPT_ID = "boundaryci-turnstile-script";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileOptions = {
  sitekey: string;
  theme: "dark";
  size: "flexible";
  appearance: "always";
  action: string;
  callback: (token: string) => void;
  "error-callback": () => boolean;
  "expired-callback": () => void;
  "timeout-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileLoadPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  const loadedApi = window.turnstile;
  if (loadedApi) return Promise.resolve(loadedApi);
  if (turnstileLoadPromise) return turnstileLoadPromise;

  const attempt = new Promise<TurnstileApi>((resolve, reject) => {
    const resolveWhenReady = () => {
      const api = window.turnstile;
      if (!api) {
        reject(new Error("Cloudflare Turnstile loaded without its browser API."));
        return;
      }
      resolve(api);
    };

    const rejectLoad = () => {
      document.getElementById(TURNSTILE_SCRIPT_ID)?.remove();
      reject(new Error("Cloudflare Turnstile could not be loaded."));
    };
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.turnstile) {
        resolveWhenReady();
        return;
      }
      existing.addEventListener("load", resolveWhenReady, { once: true });
      existing.addEventListener("error", rejectLoad, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", resolveWhenReady, { once: true });
    script.addEventListener("error", rejectLoad, { once: true });
    document.head.append(script);
  });

  turnstileLoadPromise = attempt.catch((error: unknown) => {
    turnstileLoadPromise = null;
    throw error;
  });
  return turnstileLoadPromise;
}

export type TurnstileWidgetHandle = {
  reset: () => void;
};

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, {
  siteKey: string;
  onToken: (token: string | null) => void;
  onError: (message: string | null) => void;
}>(function TurnstileWidget({ siteKey, onToken, onError }, forwardedRef) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  }, [onError, onToken]);

  useImperativeHandle(forwardedRef, () => ({
    reset() {
      const api = apiRef.current;
      const widgetId = widgetIdRef.current;
      onTokenRef.current(null);
      if (api && widgetId) api.reset(widgetId);
    },
  }), []);

  useEffect(() => {
    let active = true;
    onTokenRef.current(null);

    void loadTurnstile()
      .then((api) => {
        if (!active || !containerRef.current) return;
        apiRef.current = api;
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          size: "flexible",
          appearance: "always",
          action: "boundaryci_auth",
          callback: (token) => {
            onErrorRef.current(null);
            onTokenRef.current(token);
          },
          "error-callback": () => {
            onTokenRef.current(null);
            onErrorRef.current("The security check could not be completed. Refresh and try again.");
            return true;
          },
          "expired-callback": () => {
            onTokenRef.current(null);
            onErrorRef.current("The security check expired. Complete it again to continue.");
          },
          "timeout-callback": () => {
            onTokenRef.current(null);
            onErrorRef.current("The security check timed out. Complete it again to continue.");
          },
        });
      })
      .catch(() => {
        if (!active) return;
        onTokenRef.current(null);
        onErrorRef.current("The security check could not be loaded. Refresh and try again.");
      });

    return () => {
      active = false;
      const api = apiRef.current;
      const widgetId = widgetIdRef.current;
      if (api && widgetId) api.remove(widgetId);
      apiRef.current = null;
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  return <div className="turnstile-widget" ref={containerRef} aria-label="Security check" />;
});
