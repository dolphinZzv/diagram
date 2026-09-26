import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes so a single broken component shows a readable
 * error card (with a reload button) instead of unmounting the whole app into a
 * blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the full stack in the console for debugging.
    console.error("[diagram] render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 560,
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            background: "#fff",
            padding: 24,
            boxShadow: "0 10px 30px rgba(15,23,42,.08)",
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: 18 }}>出错了 · Something went wrong</h1>
          <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13 }}>
            页面渲染时发生错误，你的内容已自动保存在本地草稿中。请尝试重试或重新加载。
          </p>
          <pre
            style={{
              margin: "0 0 16px",
              maxHeight: 180,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#f1f5f9",
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              color: "#334155",
            }}
          >
            {error.message}
          </pre>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              style={{
                border: "1px solid #e2e8f0",
                background: "#fff",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              重试 · Retry
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: "none",
                background: "#3b82f6",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              重新加载 · Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
