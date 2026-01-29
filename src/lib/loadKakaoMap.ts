declare global {
  interface Window {
    kakao?: any;
  }
}

let loading: Promise<any> | null = null;

export function loadKakaoMap(jsKey: string) {
  if (window.kakao?.maps) return Promise.resolve(window.kakao);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false`;
      script.async = true;
      script.onload = () => {
        if (!window.kakao?.maps) {
          reject(new Error("Kakao maps not available"));
          return;
        }
        window.kakao.maps.load(() => resolve(window.kakao));
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return loading;
}

export type KakaoNS = typeof window.kakao;
