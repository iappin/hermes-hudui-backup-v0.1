# Hermes HUDUI 中文备份版 v0.1

一个给 [Hermes](https://github.com/nousresearch/hermes-agent) 用的浏览器仪表盘/Web UI，用来查看 agent 的记忆、技能、会话、项目、健康状态与 token 成本。

这是 iappin 基于上游项目 [joeynyc/hermes-hudui](https://github.com/joeynyc/hermes-hudui) 整理发布的中文备份版，基线接近 v0.1 阶段，并包含我本地当时的中文化与定制修改。

> 项目定位
>
> - 用途：个人备份、公开分享、后续自行继续迭代
> - 上游来源：`joeynyc/hermes-hudui`
> - 当前仓库：`iappin/hermes-hudui-backup-v0.1`
> - 许可证：继续保留原项目 MIT License
> - 说明：这不是上游官方发布版，而是我的本地快照备份版

## 这个版本适合谁

- 想先体验较早期 Hermes HUDUI 版本的人
- 想要一个可公开访问的中文备份仓库的人
- 想在此基础上继续自己改 UI/汉化/功能的人

![Token Costs](assets/dashboard-costs.png)

![Agent Profiles](assets/profiles.png)

## What It Shows

Everything your agent knows about itself:

- **Identity** — designation, substrate, runtime, days conscious, brain size
- **What I Know** — conversations held, messages exchanged, actions taken, skills acquired
- **What I Remember** — memory capacity bars, user profile state, corrections absorbed
- **What I See** — API keys (present/dark), service health (alive/silent)
- **What I'm Learning** — recently modified skills with categories
- **What I'm Working On** — active projects with dirty file status
- **What Runs While You Sleep** — scheduled cron jobs
- **How I Think** — tool usage patterns with gradient bars
- **My Rhythm** — daily activity sparkline
- **Growth Delta** — snapshot diffs showing what changed
- **Token Costs** — per-model USD cost estimates with daily trend

## Real-Time Updates

The HUD updates instantly when your agent's data changes. No manual refresh needed.

- **WebSocket** — Live connection broadcasts changes as they happen
- **Smart Caching** — Backend caches expensive operations (sessions, skills, patterns) with automatic invalidation when files change
- **Silent Updates** — Data refreshes in the background without loading flashes or UI blinking
- **Live Indicator** — "● live" badge in the status bar shows when real-time connection is active

## Quick Start

```bash
git clone https://github.com/iappin/hermes-hudui-backup-v0.1.git
cd hermes-hudui-backup-v0.1
python3.11 -m venv venv
source venv/bin/activate
./install.sh
hermes-hudui
```

Open http://localhost:3001

On future runs, just activate and start:

```bash
source venv/bin/activate
hermes-hudui
```

## Requirements

- Python 3.11+
- Node.js 18+ (for building the frontend)
- A running Hermes agent with data in `~/.hermes/`

No other packages required — the Web UI reads directly from your agent's data directory.

## Manual Install

```bash
# 1. Create and activate virtual environment
python3.11 -m venv venv
source venv/bin/activate

# 2. Install this package
pip install -e .

# 3. Build the frontend
cd frontend
npm install
npm run build
cp -r dist/* ../backend/static/

# 4. Start the server
hermes-hudui
```

## Themes

Four color themes, switchable with `t` key or the theme picker:

| Theme | Key | Mood |
|-------|-----|------|
| **Neural Awakening** | `ai` | Cyan/blue on deep navy. Clean, clinical intelligence. |
| **Blade Runner** | `blade-runner` | Amber/orange on warm black. Neo-noir dystopia. |
| **fsociety** | `fsociety` | Green on pure black. Raw hacker aesthetic. |
| **Anime** | `anime` | Purple/violet on indigo. Psychic energy. |

Optional CRT scanline overlay — toggle via theme picker.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1`-`9`, `0` | Switch tabs |
| `t` | Toggle theme picker |
| `Ctrl+K` | Command palette |

## Architecture

```
React Frontend (Vite + SWR)
    ↓ /api/* (proxied in dev) + WebSocket /ws
FastAPI Backend (Python)
    ↓ collectors/*.py + cache + file watcher
~/.hermes/ (agent data files)
```

**Backend:**
- **Collectors** — Read from `~/.hermes/` and return dataclasses
- **Caching** — Intelligent cache with mtime-based invalidation (sessions: 30s, skills: 60s, patterns: 60s, profiles: 45s TTL)
- **File Watcher** — Watches `~/.hermes/` for changes using `watchfiles`
- **WebSocket** — Broadcasts `data_changed` events to all connected clients

**Frontend:**
- **SWR** — Fetches from `/api/*` with `keepPreviousData` for silent background updates
- **WebSocket Hook** — Auto-reconnect with exponential backoff, triggers SWR revalidation on change events
- **Panels** — One component per tab, shows stale data during refresh (no loading flashes)

## Token Cost Pricing

Costs are calculated from token counts using hardcoded per-model pricing. Supported models:

| Provider | Model | Input | Output | Cache Read |
|----------|-------|------:|-------:|-----------:|
| Anthropic | Claude Opus 4 | $15/M | $75/M | $1.50/M |
| Anthropic | Claude Sonnet 4 | $3/M | $15/M | $0.30/M |
| Anthropic | Claude Haiku 3.5 | $0.80/M | $4/M | $0.08/M |
| OpenAI | GPT-4o | $2.50/M | $10/M | $1.25/M |
| OpenAI | o1 | $15/M | $60/M | $7.50/M |
| DeepSeek | V3 | $0.27/M | $1.10/M | $0.07/M |
| xAI | Grok 3 | $3/M | $15/M | $0.75/M |
| Google | Gemini 2.5 Pro | $1.25/M | $10/M | $0.31/M |

Models not in the table fall back to Claude Opus pricing. Local/free models are detected and priced at $0.

## Relationship to the TUI

This is the browser companion to [hermes-hud](https://github.com/joeynyc/hermes-hud). Both read from the same `~/.hermes/` data directory independently. You can use either one, or both at the same time.

The Web UI is fully standalone — it ships its own data collectors and doesn't require the TUI package. It adds features the TUI doesn't have: dedicated Memory, Skills, and Sessions tabs; per-model token cost tracking; command palette; theme switcher with live preview.

If you also have the TUI installed (`pip install hermes-hud`), you can enable it with `pip install hermes-hudui[tui]`.

## Platform Support

- **macOS** — native, install via `./install.sh`
- **Linux** — native, install via `./install.sh`
- **Windows** — via WSL (Windows Subsystem for Linux)
- **WSL** — install script detects WSL automatically

## License

MIT — see [LICENSE](LICENSE).
## Star History

<a href="https://www.star-history.com/?repos=joeynyc%2Fhermes-hudui&type=date&logscale=&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=joeynyc/hermes-hudui&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=joeynyc/hermes-hudui&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=joeynyc/hermes-hudui&type=date&legend=top-left" />
 </picture>
</a>
