export type XLSXModule = {
  utils: Record<string, any>;
  writeFile: (...args: any[]) => void;
  [key: string]: any;
};

let loadingPromise: Promise<XLSXModule> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-xlsx-loader="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load XLSX script")));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.xlsxLoader = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load XLSX script"));
    document.body.appendChild(script);
  });
}

export async function loadXlsx(): Promise<XLSXModule> {
  if (typeof window === "undefined") {
    throw new Error("XLSX loader is only available in the browser");
  }
  if ((window as any).XLSX) {
    return (window as any).XLSX;
  }
  if (!loadingPromise) {
    loadingPromise = injectScript("https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js")
      .then(() => (window as any).XLSX)
      .catch((error) => {
        loadingPromise = null;
        throw error;
      });
  }
  return loadingPromise;
}
