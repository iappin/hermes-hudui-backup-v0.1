import { useApi } from '../hooks/useApi'
import Panel, { CapacityBar } from './Panel'

function MemoryEntries({ entries }: { entries: any[] }) {
  if (!entries?.length) return <div className="text-[13px]" style={{ color: 'var(--hud-text-dim)' }}>暂无条目</div>

  return (
    <div className="space-y-1.5">
      {entries.map((e: any, i: number) => (
        <div key={i} className="text-[13px] py-1.5 px-2" style={{ background: 'var(--hud-bg-panel)', borderLeft: '2px solid var(--hud-border)' }}>
          <div className="flex justify-between mb-0.5">
            <span className="uppercase tracking-wider text-[13px] font-bold" style={{ color: 'var(--hud-primary)' }}>
              {e.category}
            </span>
            <span className="text-[13px]" style={{ color: 'var(--hud-text-dim)' }}>{e.char_count}c</span>
          </div>
          <div style={{ color: 'var(--hud-text)' }}>{e.text}</div>
        </div>
      ))}
    </div>
  )
}

export default function MemoryPanel() {
  const { data, isLoading } = useApi('/memory', 30000)

  // Only show loading on initial load
  if (isLoading && !data) {
    return <Panel title="记忆" className="col-span-full"><div className="glow text-[13px] animate-pulse">加载中...</div></Panel>
  }

  const { memory, user } = data

  return (
    <>
      <Panel title="代理记忆" className="col-span-1">
        <CapacityBar value={memory?.total_chars || 0} max={memory?.max_chars || 2200} label="容量" />
        <div className="text-[13px] my-2" style={{ color: 'var(--hud-text-dim)' }}>
          {memory?.entry_count || 0} 条 · {Object.entries(memory?.count_by_category || {}).map(([k,v]) => `${k}(${v})`).join(' ')}
        </div>
        <MemoryEntries entries={memory?.entries || []} />
      </Panel>

      <Panel title="用户画像" className="col-span-1">
        <CapacityBar value={user?.total_chars || 0} max={user?.max_chars || 1375} label="容量" />
        <div className="text-[13px] my-2" style={{ color: 'var(--hud-text-dim)' }}>
          {user?.entry_count || 0} 条
        </div>
        <MemoryEntries entries={user?.entries || []} />
      </Panel>
    </>
  )
}
