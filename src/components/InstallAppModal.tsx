import React from "react";
import { Plus, X } from "lucide-react";
import { INSTALL_FLAG_KEY, markPwaInstalled } from "../lib/pwaInstall";

type OSOption = "android" | "ios";

type Props = {
  open: boolean;
  onClose: () => void;
  onInstalled?: () => void;
};

type BeforeInstallPromptEvent = Event & {
  readonly platforms?: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string[] }>;
  prompt: () => Promise<void>;
};

const OS_META: Record<OSOption, { label: string; sub: string }> = {
  android: { label: "안드로이드", sub: "홈 화면 추가" },
  ios: { label: "아이폰", sub: "홈 화면 추가" },
};

const detectPreferredOS = (): OSOption => {
  if (typeof navigator === "undefined") return "android";
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return "android";
};

export default function InstallAppModal({ open, onClose, onInstalled }: Props) {
  const [activeOS, setActiveOS] = React.useState<OSOption>(detectPreferredOS);
  const [installPrompt, setInstallPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [androidMessage, setAndroidMessage] = React.useState("");

  const markInstalled = React.useCallback(() => {
    markPwaInstalled();
    onInstalled?.();
  }, [onInstalled]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  React.useEffect(() => {
    setAndroidMessage("");
  }, [activeOS]);

  const handleAndroidInstall = async () => {
    if (!installPrompt) {
      setAndroidMessage("크롬 메뉴(⋮)에서 '홈 화면에 추가'를 눌러 주세요.");
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setAndroidMessage("설치 요청을 보냈어요. 홈 화면에서 새 아이콘을 확인해 주세요.");
        markInstalled();
      } else {
        setAndroidMessage("설치를 취소했어요. 언제든 다시 시도할 수 있습니다.");
      }
    } catch (err) {
      setAndroidMessage("설치를 진행할 수 없습니다. 크롬 최신 버전인지 확인해 주세요.");
    } finally {
      setInstallPrompt(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-[24px] border border-neutral-100 bg-white/98 px-6 py-6 shadow-[0_24px_55px_rgba(15,23,42,0.25)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-neutral-400">RJ REAL ESTATE</p>
            <h3 className="text-xl font-semibold text-neutral-900">홈 화면에 설치하기</h3>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {(["android", "ios"] as OSOption[]).map((os) => {
            const active = activeOS === os;
            return (
              <button
                key={os}
                type="button"
                onClick={() => setActiveOS(os)}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-4 py-3 text-xs font-semibold transition ${
                  active
                    ? "border-neutral-900 text-neutral-900 shadow-[0_8px_20px_rgba(15,23,42,0.15)]"
                    : "border-neutral-200 text-neutral-500 hover:border-neutral-400"
                }`}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-neutral-400 ${
                    active ? "border-neutral-800 text-neutral-900" : "border-neutral-200"
                  }`}
                >
                  <Plus className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-semibold text-neutral-900">{OS_META[os].label}</span>
                <span className="text-[10px] font-medium text-neutral-400">{OS_META[os].sub}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {activeOS === "android" ? (
            <AndroidGuide onInstall={handleAndroidInstall} message={androidMessage} />
          ) : (
            <IOSGuide onManualComplete={markInstalled} />
          )}
        </div>
      </div>
    </div>
  );
}

function GuideList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 text-sm text-neutral-700">
      {steps.map((step, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white">
            {idx + 1}
          </span>
          <span className="leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function AndroidGuide({ onInstall, message }: { onInstall: () => void; message: string }) {
  return (
    <div className="space-y-4">
      <GuideList
        steps={[
          "크롬으로 리버원 뷰어 페이지를 열어 주세요.",
          "주소창 우측의 ⋮ 메뉴에서 '홈 화면에 추가'를 선택합니다.",
          "아이콘 이름을 확인하고 추가 버튼을 누르면 홈 화면에 설치됩니다.",
        ]}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onInstall}
          className="flex-1 rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(0,0,0,0.25)] hover:bg-black transition"
        >
          설치 시도
        </button>
      </div>
      {message ? <p className="text-xs text-neutral-500">{message}</p> : null}
    </div>
  );
}

function IOSGuide({ onManualComplete }: { onManualComplete: () => void }) {
  return (
    <div className="space-y-4">
      <GuideList
        steps={[
          "Safari에서 리버원 뷰어 페이지를 열어 주세요.",
          "하단 공유 아이콘(⬆️)에서 '홈 화면에 추가'를 선택합니다.",
          "아이콘 이름을 확인하고 '추가'를 누르면 홈 화면에 설치됩니다.",
        ]}
      />
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        * iPhone/iPad에서는 반드시 Safari에서만 홈 화면 추가가 가능합니다. 다른 브라우저를 사용 중이라면 주소를 복사해
        Safari에 붙여넣어 주세요.
      </div>
      <button
        type="button"
        onClick={onManualComplete}
        className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-xs font-semibold text-neutral-600 hover:border-neutral-400"
      >
        설치 완료했어요
      </button>
    </div>
  );
}
