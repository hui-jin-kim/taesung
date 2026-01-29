import { useEffect, useState } from "react";

export function useScript(src: string) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<null | Error>(null);

  useEffect(() => {
    let el = document.querySelector(`script[data-src="${src}"]`) as HTMLScriptElement | null;
    if (el && (el as any)._loaded) { setLoaded(true); return; }
    if (!el) {
      el = document.createElement("script");
      el.async = true;
      el.src = src;
      el.setAttribute("data-src", src);
      document.head.appendChild(el);
    }
    const onLoad = () => { (el as any)._loaded = true; setLoaded(true); };
    const onError = () => { setError(new Error(`Failed to load script: ${src}`)); };
    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    return () => {
      el?.removeEventListener("load", onLoad);
      el?.removeEventListener("error", onError);
    };
  }, [src]);

  return { loaded, error } as const;
}

