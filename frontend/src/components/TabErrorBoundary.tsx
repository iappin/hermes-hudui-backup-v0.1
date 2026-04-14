import { Component, type ErrorInfo, type ReactNode } from 'react'

interface TabErrorBoundaryProps {
  children: ReactNode
  resetKey: string
}

interface TabErrorBoundaryState {
  error: Error | null
}

export default class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  state: TabErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): TabErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[HUD] 标签页渲染失败:', error, info.componentStack)
  }

  componentDidUpdate(prevProps: TabErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        className="hud-panel col-span-full"
        style={{ minHeight: '160px' }}
      >
        <div className="hud-panel-title">标签页加载失败</div>
        <div className="hud-panel-content text-[13px]">
          <div className="mb-2" style={{ color: 'var(--hud-error)' }}>
            这个标签页刚刚渲染失败了，但 HUDUI 没有崩溃。你可以切换到其他标签页，或刷新页面重试。
          </div>
          <div className="mb-3" style={{ color: 'var(--hud-text-dim)' }}>
            {this.state.error.message || '未知错误'}
          </div>
          <button
            className="px-3 py-1.5 text-[13px] cursor-pointer"
            style={{
              background: 'var(--hud-bg-hover)',
              color: 'var(--hud-primary)',
              border: '1px solid var(--hud-border)',
            }}
            onClick={() => this.setState({ error: null })}
          >
            重试当前标签页
          </button>
        </div>
      </div>
    )
  }
}
