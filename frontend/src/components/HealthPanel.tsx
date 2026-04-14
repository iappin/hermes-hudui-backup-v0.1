import { useApi } from '../hooks/useApi'
import Panel from './Panel'

const STATUS_LABELS: Record<string, string> = {
  ok: '正常',
  dns_failed: 'DNS 失败',
  timeout: '超时',
  unreachable: '不可达',
  error: '错误',
  unknown: '未知',
}

function formatCheckedAt(value: string | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

export default function HealthPanel() {
  const { data, isLoading } = useApi('/health', 20000)

  // Only show loading on initial load
  if (isLoading && !data) {
    return <Panel title="健康状态" className="col-span-full"><div className="glow text-[13px] animate-pulse">加载中...</div></Panel>
  }

  const keys = data.keys || []
  const services = data.services || []
  const network = data.network || {}
  const networkChecks = network.checks || []
  const proxy = network.proxy || {}

  return (
    <>
      <Panel title="API 密钥" className="col-span-1">
        <div className="space-y-1 text-[13px]">
          {keys.map((k: any, i: number) => (
            <div key={i} className="flex justify-between py-0.5">
              <span className="truncate mr-2">{k.name}</span>
              <span style={{ color: k.present ? 'var(--hud-success)' : 'var(--hud-error)' }}>
                {k.present ? '●' : '○'}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 text-[13px]" style={{ borderTop: '1px solid var(--hud-border)' }}>
          <span style={{ color: 'var(--hud-success)' }}>{data.keys_ok || 0}</span>
          <span style={{ color: 'var(--hud-text-dim)' }}> 已配置 · </span>
          <span style={{ color: data.keys_missing > 0 ? 'var(--hud-error)' : 'var(--hud-text-dim)' }}>{data.keys_missing || 0}</span>
          <span style={{ color: 'var(--hud-text-dim)' }}> 缺失</span>
        </div>
      </Panel>

      <Panel title="服务" className="col-span-1">
        <div className="space-y-2 text-[13px]">
          {services.map((s: any, i: number) => (
            <div key={i} className="py-1 px-2" style={{ borderLeft: `2px solid ${s.running ? 'var(--hud-success)' : 'var(--hud-error)'}` }}>
              <div className="flex justify-between">
                <span>{s.name}</span>
                <span style={{ color: s.running ? 'var(--hud-success)' : 'var(--hud-error)' }}>
                  {s.running ? '运行中' : '已停止'}
                </span>
              </div>
              {s.pid && <div style={{ color: 'var(--hud-text-dim)' }}>PID {s.pid}</div>}
              {s.note && <div style={{ color: 'var(--hud-text-dim)' }}>{s.note}</div>}
            </div>
          ))}
        </div>
        <div className="mt-3 text-[13px]" style={{ color: 'var(--hud-text-dim)' }}>
          <div>提供商：{data.config_provider || '-'}</div>
          <div>模型：{data.config_model || '-'}</div>
          <div>数据库：{data.state_db_exists ? `${(data.state_db_size / 1048576).toFixed(1)}MB` : '缺失'}</div>
        </div>
      </Panel>

      <Panel title="代理网络连通性" className="col-span-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[13px] mb-3">
          <div>
            <span style={{ color: network.ok ? 'var(--hud-success)' : 'var(--hud-error)' }}>
              {network.ok ? '● 代理链路可用' : '● 代理链路异常'}
            </span>
            <span className="ml-2" style={{ color: 'var(--hud-text-dim)' }}>
              最近检查：{formatCheckedAt(network.checked_at)}
            </span>
          </div>
          <div style={{ color: 'var(--hud-text-dim)' }}>
            {data.config_provider || '-'} / {data.config_model || '-'}
          </div>
        </div>

        <div className="text-[13px] mb-3 p-2" style={{ background: 'var(--hud-bg-panel)', borderLeft: `3px solid ${proxy.detected ? 'var(--hud-success)' : 'var(--hud-warning)'}` }}>
          <span style={{ color: proxy.detected ? 'var(--hud-success)' : 'var(--hud-warning)' }}>
            {proxy.detected ? '检测到显式代理' : '未检测到显式代理'}
          </span>
          <span className="ml-2" style={{ color: 'var(--hud-text-dim)' }}>
            来源：{proxy.source || 'none'} · {proxy.detail || '可能使用 TUN/VPN/透明代理'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[13px]">
          {networkChecks.map((check: any, i: number) => {
            const statusLabel = STATUS_LABELS[check.status] || check.status?.replace('http_', 'HTTP ') || '未知'
            return (
              <div
                key={`${check.name}-${i}`}
                className="p-2"
                style={{
                  background: 'var(--hud-bg-panel)',
                  borderLeft: `3px solid ${check.ok ? 'var(--hud-success)' : 'var(--hud-error)'}`,
                }}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-bold" style={{ color: 'var(--hud-primary)' }}>{check.name}</span>
                  <span style={{ color: check.ok ? 'var(--hud-success)' : 'var(--hud-error)' }}>
                    {check.ok ? '●' : '●'} {statusLabel}
                  </span>
                </div>
                <div className="truncate mt-1" title={check.target} style={{ color: 'var(--hud-text-dim)' }}>
                  {check.target}
                </div>
                <div className="mt-1" style={{ color: 'var(--hud-text-dim)' }}>
                  延迟：{check.latency_ms != null ? `${check.latency_ms} ms` : '-'}
                </div>
                {check.note && (
                  <div className="truncate mt-1" title={check.note} style={{ color: 'var(--hud-warning)' }}>
                    {check.note}
                  </div>
                )}
              </div>
            )
          })}
          {networkChecks.length === 0 && (
            <div className="text-[13px]" style={{ color: 'var(--hud-text-dim)' }}>
              暂无网络检查结果
            </div>
          )}
        </div>
      </Panel>
    </>
  )
}
