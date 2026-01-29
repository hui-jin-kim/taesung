import React from "react";
import AdminFrame from "../components/AdminFrame";

export function AlertConsolePanel() {
  const [title, setTitle] = React.useState("알림 제목");
  const [body, setBody] = React.useState("스태프용 테스트 알림입니다.");
  const [url, setUrl] = React.useState("/listings");
  const [log, setLog] = React.useState<string>("");

  async function sendLocalNotification() {
    try {
      if (!("Notification" in window)) {
        setLog("이 브라우저는 알림을 지원하지 않습니다.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setLog("권한 거부");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title || "알림", {
        body: body || "",
        data: { url },
        icon: "/vite.svg",
        badge: "/vite.svg",
      });
      setLog("로컬 알림 전송 완료");
    } catch (e: any) {
      setLog("전송 실패: " + (e?.message || e));
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <div>
          <label className="block text-sm text-neutral-700">제목</label>
          <input className="mt-1 w-full border rounded px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-neutral-700">내용</label>
          <input className="mt-1 w-full border rounded px-3 py-2" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-neutral-700">URL(이동 경로)</label>
          <input className="mt-1 w-full border rounded px-3 py-2" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-md bg-blue-600 text-white text-sm px-3 py-1.5" onClick={sendLocalNotification}>
            로컬 알림 발송
          </button>
        </div>
        {log ? <div className="text-xs text-neutral-600">{log}</div> : null}
      </div>
      <p className="text-xs text-neutral-500">실제 발송은 서버/FCM 연동 시 추가 구현이 필요합니다.</p>
    </div>
  );
}

export default function AdminAlerts() {
  return (
    <AdminFrame title="알림 콘솔(테스트)">
      <div className="max-w-3xl">
        <AlertConsolePanel />
      </div>
    </AdminFrame>
  );
}