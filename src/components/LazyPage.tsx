import { Component, Suspense, type ReactNode } from 'react'

class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div className="account-banner" role="alert"><p>This page couldn’t load. Reload to get the latest app version.</p><button className="button button-outline" onClick={() => window.location.reload()}>Reload app</button></div>
    return this.props.children
  }
}

export default function LazyPage({ children }: { children: ReactNode }) {
  return <PageErrorBoundary><Suspense fallback={<div className="account-loading" role="status">Loading page…</div>}>{children}</Suspense></PageErrorBoundary>
}
