import { useState, useEffect, useRef } from 'react'
import { useTheme, THEMES } from '../hooks/useTheme'
import { useApi } from '../hooks/useApi'

export const TABS = [
  { id: 'dashboard', label: '总览', key: '1' },
  { id: 'memory', label: '记忆', key: '2' },
  { id: 'skills', label: '技能', key: '3' },
  { id: 'sessions', label: '会话', key: '4' },
  { id: 'cron', label: '定时', key: '5' },
  { id: 'projects', label: '项目', key: '6' },
  { id: 'health', label: '健康', key: '7' },
  { id: 'agents', label: '代理', key: '8' },
  { id: 'profiles', label: '档案', key: '9' },
  { id: 'token-costs', label: '成本', key: '0' },
] as const

export type TabId = typeof TABS[number]['id']

interface TopBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export default function TopBar({ activeTab, onTabChange }: TopBarProps) {
  const { theme, setTheme, scanlines, setScanlines } = useTheme()
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [time, setTime] = useState(new Date())
  const themePickerRef = useRef<HTMLDivElement>(null)
  const { data: costs } = useApi('/token-costs', 60000)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!showThemePicker) return

    const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (target && themePickerRef.current?.contains(target)) return
      setShowThemePicker(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('touchstart', closeOnOutsideClick)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('touchstart', closeOnOutsideClick)
    }
  }, [showThemePicker])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // 1-9 for tabs
      const num = parseInt(e.key)
      if (!isNaN(num) && num >= 1 && num <= TABS.length) {
        onTabChange(TABS[num - 1].id)
        return
      }
      // 0 for last tab
      if (e.key === '0') {
        onTabChange('token-costs')
        return
      }
      // T to toggle theme picker
      if (e.key === 't') {
        setShowThemePicker(p => !p)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onTabChange])

  const todayCost = costs?.today?.estimated_cost_usd ?? 0
  const allTimeCost = costs?.all_time?.estimated_cost_usd ?? 0
  const clockText = time.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b"
         style={{ borderColor: 'var(--hud-border)', background: 'var(--hud-bg-surface)' }}>
      {/* Logo */}
      <span className="gradient-text font-bold text-[13px] mr-3 tracking-wider cursor-pointer shrink-0"
            onClick={() => onTabChange('dashboard')}>☤ HERMES</span>

      {/* Tabs */}
      <div className="flex gap-0.5 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="px-2 py-1.5 text-[13px] tracking-widest uppercase transition-all duration-150 shrink-0 cursor-pointer"
            style={{
              color: activeTab === tab.id ? 'var(--hud-primary)' : 'var(--hud-text-dim)',
              background: activeTab === tab.id ? 'var(--hud-bg-panel)' : 'transparent',
              borderBottom: activeTab === tab.id ? '2px solid var(--hud-primary)' : '2px solid transparent',
              textShadow: activeTab === tab.id ? '0 0 8px var(--hud-primary-glow)' : 'none',
              minHeight: '32px',
            }}
          >
            <span className="opacity-40 mr-1">{tab.key}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cost summary */}
      <div className="hidden lg:flex items-center gap-3 text-[12px] tabular-nums shrink-0 ml-2"
           style={{ color: 'var(--hud-text-dim)' }}>
        <span>
          今日 <span style={{ color: 'var(--hud-accent)' }}>${todayCost.toFixed(2)}</span>
        </span>
        <span>
          累计 <span style={{ color: 'var(--hud-accent)' }}>${allTimeCost.toFixed(2)}</span>
        </span>
      </div>

      {/* Theme picker */}
      <div ref={themePickerRef} className="relative shrink-0">
        <button
          onClick={() => setShowThemePicker(p => !p)}
          className="px-2 py-1.5 text-[13px] tracking-wider uppercase cursor-pointer"
          style={{ color: 'var(--hud-text-dim)', minHeight: '32px' }}
          title="主题 (t)"
        >
          ◆
        </button>
        {showThemePicker && (
          <div className="absolute right-0 top-full mt-1 z-50 py-1 min-w-[180px]"
               style={{ background: 'var(--hud-bg-panel)', border: '1px solid var(--hud-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); setShowThemePicker(false) }}
                className="block w-full text-left px-3 py-2 text-[13px] transition-colors cursor-pointer"
                style={{
                  color: theme === t.id ? 'var(--hud-primary)' : 'var(--hud-text)',
                  background: theme === t.id ? 'var(--hud-bg-hover)' : 'transparent',
                  minHeight: '36px',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
            <div className="border-t my-1" style={{ borderColor: 'var(--hud-border)' }} />
            <button
              onClick={() => setScanlines(!scanlines)}
              className="block w-full text-left px-3 py-2 text-[13px] cursor-pointer"
              style={{ color: 'var(--hud-text-dim)', minHeight: '36px' }}
            >
              {scanlines ? '▣' : '□'} 扫描线
            </button>
          </div>
        )}
      </div>

      {/* Clock */}
      <span className="text-[13px] ml-2 tabular-nums shrink-0 hidden sm:inline" style={{ color: '#f37021' }}>
        {clockText}
      </span>
    </div>
  )
}
