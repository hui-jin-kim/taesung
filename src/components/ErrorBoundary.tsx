import React from "react";

type State = { hasError: boolean; error?: unknown };

type Props = { children: React.ReactNode };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "16px",
            margin: "16px",
            border: "2px solid #ef4444",
            borderRadius: "12px",
            background: "#fff1f2",
            color: "#991b1b",
            fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>문제가 발생했습니다.</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
            {String(this.state.error ?? "Unknown error")}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#7f1d1d" }}>
            페이지를 새로고침하거나 관리자에게 문의해 주세요.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
