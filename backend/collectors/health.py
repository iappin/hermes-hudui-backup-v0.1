"""Health check collector — API keys, services, connectivity."""

from __future__ import annotations

import json
import os
import socket
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

from .utils import default_hermes_dir
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class KeyStatus:
    name: str
    source: str  # env, auth.json, config
    present: bool = False
    note: str = ""


@dataclass
class ServiceStatus:
    name: str
    running: bool = False
    pid: Optional[int] = None
    note: str = ""


@dataclass
class NetworkCheck:
    name: str
    target: str
    ok: bool = False
    latency_ms: Optional[int] = None
    status: str = "unknown"
    note: str = ""


@dataclass
class ProxyStatus:
    detected: bool = False
    source: str = "none"
    detail: str = "未检测到显式代理，可能使用 TUN/VPN/透明代理"


@dataclass
class NetworkStatus:
    checks: list[NetworkCheck] = field(default_factory=list)
    proxy: ProxyStatus = field(default_factory=ProxyStatus)
    checked_at: str = ""

    @property
    def ok(self) -> bool:
        return bool(self.checks) and all(c.ok for c in self.checks)


@dataclass
class HealthState:
    keys: list[KeyStatus] = field(default_factory=list)
    services: list[ServiceStatus] = field(default_factory=list)
    network: NetworkStatus = field(default_factory=NetworkStatus)
    config_model: str = ""
    config_provider: str = ""
    hermes_dir_exists: bool = False
    state_db_exists: bool = False
    state_db_size: int = 0

    @property
    def keys_ok(self) -> int:
        return sum(1 for k in self.keys if k.present)

    @property
    def keys_missing(self) -> int:
        return sum(1 for k in self.keys if not k.present)

    @property
    def services_ok(self) -> int:
        return sum(1 for s in self.services if s.running)

    @property
    def all_healthy(self) -> bool:
        return self.keys_missing == 0 and all(s.running for s in self.services)


# Known API keys to check
EXPECTED_KEYS = [
    ("ANTHROPIC_API_KEY", "env", "Primary LLM provider"),
    ("OPENROUTER_API_KEY", "env", "OpenRouter fallback provider"),
    ("FIREWORKS_API_KEY", "env", "Fireworks AI provider"),
    ("XAI_API_KEY", "env", "xAI / Grok API for X search"),
    ("TELEGRAM_BOT_TOKEN", "env", "Telegram gateway bot token"),
    ("ELEVENLABS_API_KEY", "env", "ElevenLabs TTS"),
]

_LAST_NETWORK: NetworkStatus | None = None


def _load_dotenv_keys(dotenv_path: str) -> set[str]:
    """Load key names from a .env file (not values)."""
    keys = set()
    try:
        with open(dotenv_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key = line.split("=", 1)[0].strip()
                    if key:
                        keys.add(key)
    except (OSError, PermissionError):
        pass
    return keys


def _get_dotenv_keys(hermes_dir: str) -> set[str]:
    """Get all key names from hermes .env files."""
    keys: set[str] = set()
    for env_path in [
        os.path.join(hermes_dir, ".env"),
        os.path.expanduser("~/.env"),
    ]:
        keys.update(_load_dotenv_keys(env_path))
    return keys


def _check_env_key(name: str, hermes_dir: str = "", dotenv_keys: set[str] | None = None) -> bool:
    """Check if a key is set in environment or .env files."""
    if os.environ.get(name, ""):
        return True
    if hermes_dir and dotenv_keys is not None:
        return name in dotenv_keys
    return False


def _check_process(name: str, pattern: str) -> ServiceStatus:
    """Check if a process matching pattern is running."""
    try:
        result = subprocess.run(
            ["pgrep", "-f", pattern],
            capture_output=True, text=True, timeout=5,
        )
        pids = [int(p) for p in result.stdout.strip().split("\n") if p.strip()]
        if pids:
            return ServiceStatus(name=name, running=True, pid=pids[0])
        return ServiceStatus(name=name, running=False)
    except (subprocess.TimeoutExpired, FileNotFoundError, ValueError):
        return ServiceStatus(name=name, running=False, note="check failed")


def _check_pid_file(name: str, pid_file: Path) -> ServiceStatus:
    """Check if a PID file exists and the process is alive."""
    if not pid_file.exists():
        return ServiceStatus(name=name, running=False, note="no pid file")

    try:
        data = json.loads(pid_file.read_text())
        pid = data.get("pid")
        if pid:
            # Check if process is alive
            result = subprocess.run(
                ["ps", "-p", str(pid), "-o", "pid="],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0 and result.stdout.strip():
                return ServiceStatus(name=name, running=True, pid=pid)
            return ServiceStatus(name=name, running=False, pid=pid, note="pid file exists but process dead")
    except (json.JSONDecodeError, OSError, subprocess.TimeoutExpired):
        pass

    return ServiceStatus(name=name, running=False, note="pid file unreadable")


def _check_systemd_service(name: str, service: str) -> ServiceStatus:
    """Check systemd user service status."""
    try:
        result = subprocess.run(
            ["systemctl", "--user", "is-active", service],
            capture_output=True, text=True, timeout=5,
        )
        is_active = result.stdout.strip() == "active"
        return ServiceStatus(name=name, running=is_active, note=result.stdout.strip())
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ServiceStatus(name=name, running=False, note="systemctl unavailable")


def _elapsed_ms(start: float) -> int:
    return int((time.monotonic() - start) * 1000)


def _check_dns(hostname: str, timeout: float = 2.0) -> NetworkCheck:
    start = time.monotonic()
    previous_timeout = socket.getdefaulttimeout()
    socket.setdefaulttimeout(timeout)
    try:
        socket.getaddrinfo(hostname, 443)
        return NetworkCheck(
            name="DNS 解析",
            target=hostname,
            ok=True,
            latency_ms=_elapsed_ms(start),
            status="ok",
        )
    except socket.gaierror as exc:
        return NetworkCheck(
            name="DNS 解析",
            target=hostname,
            ok=False,
            latency_ms=_elapsed_ms(start),
            status="dns_failed",
            note=str(exc),
        )
    except OSError as exc:
        return NetworkCheck(
            name="DNS 解析",
            target=hostname,
            ok=False,
            latency_ms=_elapsed_ms(start),
            status="error",
            note=str(exc),
        )
    finally:
        socket.setdefaulttimeout(previous_timeout)


def _check_https(name: str, url: str, timeout: float = 3.0) -> NetworkCheck:
    start = time.monotonic()
    req = Request(url, method="GET", headers={"User-Agent": "hermes-hudui-health/0.1"})
    try:
        with urlopen(req, timeout=timeout) as resp:
            return NetworkCheck(
                name=name,
                target=url,
                ok=True,
                latency_ms=_elapsed_ms(start),
                status=f"http_{resp.status}",
            )
    except HTTPError as exc:
        # HTTP 401/403/404 still proves DNS, TCP, TLS, and HTTP reached the host.
        return NetworkCheck(
            name=name,
            target=url,
            ok=True,
            latency_ms=_elapsed_ms(start),
            status=f"http_{exc.code}",
            note="HTTP 已响应",
        )
    except TimeoutError as exc:
        return NetworkCheck(
            name=name,
            target=url,
            ok=False,
            latency_ms=_elapsed_ms(start),
            status="timeout",
            note=str(exc) or "request timed out",
        )
    except URLError as exc:
        reason = getattr(exc, "reason", exc)
        status = "timeout" if isinstance(reason, TimeoutError) else "unreachable"
        return NetworkCheck(
            name=name,
            target=url,
            ok=False,
            latency_ms=_elapsed_ms(start),
            status=status,
            note=str(reason),
        )
    except OSError as exc:
        return NetworkCheck(
            name=name,
            target=url,
            ok=False,
            latency_ms=_elapsed_ms(start),
            status="error",
            note=str(exc),
        )


def _collect_network(provider: str = "") -> NetworkStatus:
    global _LAST_NETWORK
    check_fns = [
        lambda: _check_dns("chatgpt.com"),
        lambda: _check_https("OpenAI / ChatGPT", "https://chatgpt.com/"),
        lambda: _check_https("Anthropic / Claude", "https://api.anthropic.com/"),
        lambda: _check_https("Google / Gemini", "https://generativelanguage.googleapis.com/"),
        lambda: _check_https("OpenRouter", "https://openrouter.ai/"),
    ]

    if provider == "openai-codex":
        check_fns.append(
            lambda: _check_https("当前 Codex Endpoint", "https://chatgpt.com/backend-api/codex")
        )

    checks: list[NetworkCheck] = []
    with ThreadPoolExecutor(max_workers=len(check_fns)) as executor:
        futures = {executor.submit(fn): i for i, fn in enumerate(check_fns)}
        results: list[NetworkCheck | None] = [None] * len(check_fns)
        for future in as_completed(futures):
            results[futures[future]] = future.result()

    checks = [check for check in results if check is not None]

    network = NetworkStatus(
        checks=checks,
        proxy=_detect_proxy(),
        checked_at=datetime.now(timezone.utc).isoformat(),
    )
    _LAST_NETWORK = network
    return network


def last_network_status() -> NetworkStatus:
    """Return the most recent full network probe, if any."""
    return _LAST_NETWORK or NetworkStatus()


def _mask_proxy_url(value: str) -> str:
    try:
        parsed = urlsplit(value)
        if parsed.username or parsed.password:
            host = parsed.hostname or ""
            port = f":{parsed.port}" if parsed.port else ""
            return urlunsplit((parsed.scheme, f"***:***@{host}{port}", parsed.path, parsed.query, parsed.fragment))
    except ValueError:
        pass
    return value


def _env_proxy_detail() -> Optional[str]:
    proxy_keys = [
        "HTTPS_PROXY", "https_proxy",
        "HTTP_PROXY", "http_proxy",
        "ALL_PROXY", "all_proxy",
    ]
    parts = []
    for key in proxy_keys:
        value = os.environ.get(key)
        if value:
            parts.append(f"{key}={_mask_proxy_url(value)}")
    return "; ".join(parts) if parts else None


def _system_proxy_detail() -> Optional[str]:
    try:
        result = subprocess.run(
            ["scutil", "--proxy"],
            capture_output=True,
            text=True,
            timeout=3,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None

    values: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip()

    details = []
    if values.get("HTTPEnable") == "1":
        details.append(f"HTTP {values.get('HTTPProxy', '?')}:{values.get('HTTPPort', '?')}")
    if values.get("HTTPSEnable") == "1":
        details.append(f"HTTPS {values.get('HTTPSProxy', '?')}:{values.get('HTTPSPort', '?')}")
    if values.get("SOCKSEnable") == "1":
        details.append(f"SOCKS {values.get('SOCKSProxy', '?')}:{values.get('SOCKSPort', '?')}")
    return "; ".join(details) if details else None


def _detect_proxy() -> ProxyStatus:
    env_detail = _env_proxy_detail()
    if env_detail:
        return ProxyStatus(detected=True, source="env", detail=env_detail)

    system_detail = _system_proxy_detail()
    if system_detail:
        return ProxyStatus(detected=True, source="macOS", detail=system_detail)

    return ProxyStatus()


def collect_health(hermes_dir: str | None = None, include_network: bool = True) -> HealthState:
    """Collect health status."""
    if hermes_dir is None:
        hermes_dir = default_hermes_dir(hermes_dir)

    hermes_path = Path(hermes_dir)
    state = HealthState()

    # Directory checks
    state.hermes_dir_exists = hermes_path.exists()
    state_db = hermes_path / "state.db"
    state.state_db_exists = state_db.exists()
    if state.state_db_exists:
        try:
            state.state_db_size = state_db.stat().st_size
        except OSError:
            pass

    # Config — reuse the config collector
    from .config import collect_config
    try:
        config = collect_config(hermes_dir)
        state.config_model = config.model
        state.config_provider = config.provider
    except Exception:
        pass

    if include_network:
        state.network = _collect_network(state.config_provider)

    # API keys
    dotenv_keys = _get_dotenv_keys(hermes_dir)

    known_names = {key_name for key_name, _, _ in EXPECTED_KEYS}
    for key_name, source, note in EXPECTED_KEYS:
        present = _check_env_key(key_name, hermes_dir, dotenv_keys)
        state.keys.append(KeyStatus(
            name=key_name,
            source=source,
            present=present,
            note=note if not present else "",
        ))

    # Auto-discover any additional API keys/tokens found in .env files
    for extra_key in sorted(dotenv_keys):
        if extra_key not in known_names:
            if any(extra_key.endswith(suffix) for suffix in ("_API_KEY", "_TOKEN", "_SECRET")):
                state.keys.append(KeyStatus(
                    name=extra_key,
                    source="env",
                    present=True,
                    note="discovered",
                ))

    # Services
    state.services.append(
        _check_pid_file("Telegram Gateway", hermes_path / "gateway.pid")
    )
    state.services.append(
        _check_systemd_service("Gateway (systemd)", "hermes-gateway")
    )
    state.services.append(
        _check_process("llama-server", "llama-server")
    )

    return state
