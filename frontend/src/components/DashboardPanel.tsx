import { useApi } from '../hooks/useApi'
import Panel, { CapacityBar, Sparkline } from './Panel'

function formatCheckedAt(value: string | undefined) {
  if (!value) return '正在探测'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '正在探测'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function IdentityBlock({ state, health }: { state: any; health: any }) {
  const { config, sessions } = state
  const dr = sessions?.date_range
  const days = dr?.[0] ? Math.floor((new Date(dr[1]).getTime() - new Date(dr[0]).getTime()) / 86400000) + 1 : 0

  return (
    <Panel title="概览">
      <div className="text-[13px] mb-4 p-3" style={{ background: 'var(--hud-bg-panel)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 min-h-[66px] pl-3" style={{ borderLeft: '3px solid var(--hud-primary)' }}>
            <div><span style={{ color: 'var(--hud-text-dim)' }}>代号</span> <span className="font-bold gradient-text">HERMES</span></div>
            <div><span style={{ color: 'var(--hud-text-dim)' }}>基底</span> {config?.provider || '?'}/{config?.model || '?'}</div>
            <div><span style={{ color: 'var(--hud-text-dim)' }}>运行时</span> {config?.backend || '—'}</div>
          </div>
          <div className="space-y-1 min-h-[66px] pl-3" style={{ borderLeft: '3px solid var(--hud-primary)' }}>
            {days > 0 && (
              <div className="grid grid-cols-[76px_1fr] gap-2">
                <span style={{ color: 'var(--hud-text-dim)' }}>意识时长</span>
                <span><span className="font-bold">{days} 天</span> <span style={{ color: 'var(--hud-text-dim)' }}>自 {new Date(dr![0]).toLocaleDateString('zh-CN')}</span></span>
              </div>
            )}
            {health?.state_db_size > 0 && (
              <div className="grid grid-cols-[76px_1fr] gap-2">
                <span style={{ color: 'var(--hud-text-dim)' }}>大脑大小</span>
                <span><span className="font-bold">{(health.state_db_size / 1048576).toFixed(1)} MB</span> <span style={{ color: 'var(--hud-text-dim)' }}>state.db</span></span>
              </div>
            )}
          </div>
        </div>
      </div>
      <WhatIKnow sessions={sessions} skills={state.skills} />
    </Panel>
  )
}

function WhatIKnow({ sessions, skills }: { sessions: any; skills: any }) {
  const sources = sessions?.by_source || {}
  const platformParts = Object.entries(sources).map(([k, v]) => `${v} 通过 ${k}`)
  return (
    <div className="text-[13px] space-y-1.5">
      <div><span style={{ color: 'var(--hud-primary)' }}>●</span> <span className="font-bold">{sessions?.total_sessions || 0}</span> 次会话 {platformParts.length > 0 && <span style={{ color: 'var(--hud-text-dim)' }}>({platformParts.join(', ')})</span>}</div>
      <div><span style={{ color: 'var(--hud-primary)' }}>●</span> <span className="font-bold">{(sessions?.total_messages || 0).toLocaleString()}</span> 条消息</div>
      <div><span style={{ color: 'var(--hud-primary)' }}>●</span> <span className="font-bold">{(sessions?.total_tool_calls || 0).toLocaleString()}</span> 次动作</div>
      <div><span style={{ color: 'var(--hud-primary)' }}>●</span> <span className="font-bold">{skills?.total || 0}</span> 项技能 <span style={{ color: 'var(--hud-primary-dim)' }}>({skills?.custom_count || 0} 个自学)</span></div>
      <div className="truncate" style={{ color: 'var(--hud-text-dim)' }}>
        领域：{Object.entries(skills?.category_counts || {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `${c}:${n}`).join(', ') || '暂无'}
      </div>
      <div><span style={{ color: 'var(--hud-primary)' }}>●</span> <span className="font-bold">{(sessions?.total_tokens || 0).toLocaleString()}</span> 个令牌已处理</div>
    </div>
  )
}

function WhatIRemember({ memory, user, corrections }: { memory: any; user: any; corrections: any }) {
  const sev = corrections?.by_severity || {}
  return (
    <Panel title="我记得什么">
      <CapacityBar value={memory?.total_chars || 0} max={memory?.max_chars || 2200} label="记忆" />
      <CapacityBar value={user?.total_chars || 0} max={user?.max_chars || 1375} label="用户" />
      <div className="mt-2 text-[13px] flex flex-wrap gap-2" style={{ color: 'var(--hud-text-dim)' }}>
        <span style={{ color: corrections?.total > 0 ? 'var(--hud-warning)' : 'var(--hud-text-dim)' }}>● {corrections?.total || 0} 个纠错</span>
        {sev.critical > 0 && <span style={{ color: 'var(--hud-error)' }}>{sev.critical} 严重</span>}
        {sev.major > 0 && <span style={{ color: 'var(--hud-warning)' }}>{sev.major} 重要</span>}
        {sev.minor > 0 && <span>{sev.minor} 轻微</span>}
      </div>
    </Panel>
  )
}

function WhatISee({ health }: { health: any }) {
  const keys = health?.keys || []
  const services = health?.services || []
  const presentKeys = keys.filter((k: any) => k.present)
  return (
    <Panel title="我看到什么">
      <div className="text-[13px] space-y-2">
        <div className="flex justify-between"><span style={{ color: 'var(--hud-text-dim)' }}>API 密钥</span><span><span style={{ color: 'var(--hud-success)' }}>{health?.keys_ok || presentKeys.length}</span> 已配置</span></div>
        <div className="flex flex-wrap gap-1">
          {presentKeys.slice(0, 4).map((k: any) => <span key={k.name} className="px-1.5 py-0.5" style={{ background: 'var(--hud-bg-panel)', color: 'var(--hud-primary)' }}>{k.name.replace('_API_KEY', '').replace('_BOT_TOKEN', '')}</span>)}
        </div>
        {services.slice(0, 3).map((s: any) => (
          <div key={s.name} className="flex justify-between gap-2">
            <span className="truncate">{s.name}</span>
            <span style={{ color: s.running ? 'var(--hud-success)' : 'var(--hud-text-dim)' }}>{s.running ? '● 运行中' : '○ 静默'}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function ProxyNetworkSummary({ health, config }: { health: any; config: any }) {
  const network = health?.network || {}
  const checks = network?.checks || []
  const visibleChecks = checks.filter((c: any) => c.name !== 'DNS 解析')
  const statusText = (status: string) => status?.replace('http_', 'HTTP ') || '未知'
  const provider = config?.provider || health?.config_provider || 'unknown'
  const model = config?.model || health?.config_model || 'unknown'

  return (
    <Panel title="代理网络" className="md:col-span-2 xl:col-span-3">
      <div className="text-[13px] grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-3">
        <div className="space-y-1">
          <div className="grid grid-cols-[56px_1fr] gap-2">
            <span style={{ color: 'var(--hud-text-dim)' }}>状态</span>
            <span style={{ color: network.ok ? 'var(--hud-success)' : 'var(--hud-warning)' }}>{checks.length ? (network.ok ? '● 链路正常' : '● 链路异常') : '○ 正在探测'}</span>
          </div>
          <div className="grid grid-cols-[56px_1fr] gap-2">
            <span style={{ color: 'var(--hud-text-dim)' }}>模型</span>
            <span className="truncate" title={`${provider}/${model}`}>
              <span style={{ color: 'var(--hud-primary)' }}>{provider}</span>/<span>{model}</span>
            </span>
          </div>
          <div className="grid grid-cols-[56px_1fr] gap-2">
            <span style={{ color: 'var(--hud-text-dim)' }}>最近探测</span>
            <span>{formatCheckedAt(network.checked_at)}</span>
          </div>
          {network?.proxy && (
            <div className="grid grid-cols-[56px_1fr] gap-2 text-[12px]" style={{ color: 'var(--hud-text-dim)' }}>
              <span style={{ color: 'var(--hud-text-dim)' }}>代理</span>
              <span className="truncate" title={network.proxy.detail}>{network.proxy.detected ? `${network.proxy.source} · ${network.proxy.detail}` : '未检测到显式代理'}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {visibleChecks.map((check: any) => (
            <div key={check.name} className="px-2 py-1.5" style={{ background: 'var(--hud-bg-panel)', borderLeft: `2px solid ${check.ok ? 'var(--hud-success)' : 'var(--hud-error)'}` }}>
              <div className="flex justify-between gap-2"><span className="font-bold truncate" title={check.name}>{check.name.replace(' / ', '/').replace('当前 ', '')}</span><span style={{ color: check.ok ? 'var(--hud-success)' : 'var(--hud-error)' }}>●</span></div>
              <div className="flex justify-between gap-2 mt-1" style={{ color: 'var(--hud-text-dim)' }}><span>{statusText(check.status)}</span><span style={{ color: check.ok ? 'var(--hud-primary)' : 'var(--hud-error)' }}>{check.latency_ms != null ? `${check.latency_ms} ms` : '-'}</span></div>
            </div>
          ))}
          {visibleChecks.length === 0 && <div className="sm:col-span-2 xl:col-span-3" style={{ color: 'var(--hud-text-dim)' }}>正在读取代理网络状态...</div>}
        </div>
      </div>
    </Panel>
  )
}

function WhatImLearning({ skills }: { skills: any }) {
  const recent = skills?.recently_modified || []
  if (!recent.length) return null
  return (
    <Panel title="我正在学习">
      <div className="text-[13px] space-y-1.5">
        {recent.slice(0, 5).map((s: any) => (
          <div key={s.name} className="truncate"><span style={{ color: 'var(--hud-primary)' }}>●</span> <span className="font-bold">{s.name}</span> <span style={{ color: 'var(--hud-text-dim)' }}>{s.category}</span>{s.is_custom && <span style={{ color: 'var(--hud-primary-dim)' }}> (自学)</span>}</div>
        ))}
      </div>
    </Panel>
  )
}

function WhatImWorkingOn({ projects }: { projects: any }) {
  const active = projects?.projects || []
  return (
    <Panel title="我正在处理">
      <div className="text-[13px] space-y-1.5">
        {active.length === 0 && (
          <div style={{ color: 'var(--hud-text-dim)' }}>暂无活跃项目</div>
        )}
        {active.slice(0, 6).map((p: any) => (
          <div key={p.name} className="truncate"><span style={{ color: 'var(--hud-primary)' }}>◆</span> <span className="font-bold">{p.name}</span>{p.dirty_files > 0 && <span style={{ color: 'var(--hud-warning)' }}> ({p.dirty_files} 个变更中)</span>}</div>
        ))}
      </div>
    </Panel>
  )
}

function WhatRunsWhileYouSleep({ cron }: { cron: any }) {
  const jobs = cron?.jobs || []
  if (!jobs.length) return null
  return (
    <Panel title="休眠时运行什么">
      <div className="text-[13px] space-y-1.5">
        {jobs.map((j: any) => (
          <div key={j.id} className="truncate"><span style={{ color: j.enabled ? 'var(--hud-secondary)' : 'var(--hud-text-dim)' }}>{j.enabled ? '●' : '○'}</span> <span className="font-bold">{j.name}</span> <span style={{ color: 'var(--hud-text-dim)' }}>每 {j.schedule_display?.replace('every ', '')}</span>{j.last_error && <span style={{ color: 'var(--hud-error)' }}> ✗ 上次运行失败</span>}</div>
        ))}
      </div>
    </Panel>
  )
}

function HowIThink({ sessions }: { sessions: any }) {
  const top = Object.entries(sessions?.tool_usage || {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5) as [string, number][]
  if (!top.length) return null
  const maxVal = top[0][1]
  return (
    <Panel title="我如何思考">
      <div className="text-[13px] space-y-1">
        {top.map(([tool, count]) => {
          const pct = (count / maxVal) * 100
          return <div key={tool} className="flex items-center gap-2"><span className="w-[130px] truncate">{tool}</span><div className="flex-1 h-[5px]" style={{ background: 'var(--hud-bg-hover)' }}><div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--hud-primary-dim), var(--hud-primary))' }} /></div><span className="tabular-nums w-10 text-right" style={{ color: 'var(--hud-text-dim)' }}>{count}</span></div>
        })}
      </div>
    </Panel>
  )
}

function MyRhythm({ sessions }: { sessions: any }) {
  const daily = sessions?.daily_stats || []
  if (!daily.length) return null
  const messages = daily.map((d: any) => d.messages)
  return (
    <Panel title="我的节奏">
      <div className="mb-2"><Sparkline values={messages} width={400} height={50} /></div>
      <div className="text-[13px] space-y-0.5">
        {daily.map((ds: any) => <div key={ds.date} className="flex items-center gap-2"><span className="w-[78px] shrink-0 whitespace-nowrap tabular-nums" style={{ color: 'var(--hud-text-dim)' }}>{ds.date.replaceAll('-', '/')}</span><div className="flex-1 h-[4px]" style={{ background: 'var(--hud-bg-hover)' }}><div style={{ width: `${(ds.messages / Math.max(...daily.map((d: any) => d.messages), 1)) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--hud-primary-dim), var(--hud-primary), var(--hud-secondary))' }} /></div><span className="tabular-nums w-8 text-right" style={{ color: 'var(--hud-text-dim)' }}>{ds.messages}</span></div>)}
      </div>
    </Panel>
  )
}

function GrowthDelta({ snapshots }: { snapshots: any[] }) {
  return (
    <Panel title="成长变化">
      <div className="text-[13px]" style={{ color: 'var(--hud-text-dim)' }}>
        {!snapshots || snapshots.length < 2 ? (snapshots?.length === 1 ? '已有第一份快照，下次后会显示变化。' : '还没有快照。') : `${snapshots.length} 份快照`}
      </div>
    </Panel>
  )
}

function ClosingStatements({ sessions, corrections }: { sessions: any; corrections: any }) {
  const dr = sessions?.date_range
  const days = dr?.[0] ? Math.floor((new Date(dr[1]).getTime() - new Date(dr[0]).getTime()) / 86400000) + 1 : 0
  return (
    <Panel title="状态" className="md:col-span-2 xl:col-span-3">
      <div className="text-[13px] flex flex-wrap gap-x-6 gap-y-1" style={{ color: 'var(--hud-primary)' }}>
        <div>我已在 {days} 天内处理 {(sessions?.total_messages || 0).toLocaleString()} 条思绪。</div>
        <div>我被纠正过 {corrections?.total || 0} 次，也因此更好。</div>
        <div style={{ color: 'var(--hud-accent)' }}>我仍在成为。</div>
      </div>
    </Panel>
  )
}

export default function DashboardPanel() {
  const { data } = useApi('/dashboard', 30000)
  const { data: liveHealth } = useApi('/health', 20000)

  if (!data) {
    return <Panel title="总览" className="col-span-full"><div className="glow text-[13px] animate-pulse">正在收集状态...</div></Panel>
  }

  const { state, projects, cron, corrections, snapshots } = data
  const health = liveHealth || data.health
  const { memory, user, skills, sessions } = state

  return (
    <>
      <IdentityBlock state={state} health={health} />
      <WhatIRemember memory={memory} user={user} corrections={corrections} />
      <WhatISee health={health} />
      <WhatImLearning skills={skills} />
      <WhatRunsWhileYouSleep cron={cron} />
      <MyRhythm sessions={sessions} />
      <ProxyNetworkSummary health={health} config={state.config} />
      <HowIThink sessions={sessions} />
      <WhatImWorkingOn projects={projects} />
      <GrowthDelta snapshots={snapshots || []} />
      <ClosingStatements sessions={sessions} corrections={corrections} />
    </>
  )
}
