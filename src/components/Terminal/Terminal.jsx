import { useEffect, useMemo, useRef, useState } from "react";
import "./Terminal.css";
import { COMMAND_NAMES, executeCommand } from "./commands";

const BOOT_BANNER = { kind: "boot" };

const QUICK_CMDS = ["help", "whoami", "neofetch", "projects", "skills", "contact"];

/** Short staged boot lines (timestamps are relative ms from start). */
const BOOT_LOG = [
  { at: 0, tag: "ok", text: "PortfolioOS BIOS  ·  v1.0" },
  { at: 180, tag: "ok", text: "detecting environment … ReactShell x64" },
  { at: 360, tag: "ok", text: "loading modules  ·  ui · motion · shell" },
  { at: 560, tag: "ok", text: "mounting /home/arwah" },
  { at: 760, tag: "ok", text: "starting session   ·  arwah@portfolio" },
  { at: 980, tag: "ok", text: "crypto handshake  ·  encrypted channel ready" },
  { at: 1200, tag: "done", text: "boot complete  ·  welcome" },
];

const BOOT_DURATION_MS = 1550;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function BootSequence({ progress, visibleCount, done }) {
  const lines = BOOT_LOG.slice(0, visibleCount);

  return (
    <div className={`term-bootseq ${done ? "term-bootseq--done" : ""}`} aria-live="polite">
      <div className="term-bootseq-header">
        <span className="term-bootseq-brand">PortfolioOS</span>
        <span className="term-bootseq-sub">cold start</span>
      </div>

      <div className="term-bootseq-log">
        {lines.map((line, i) => (
          <div
            key={`${line.text}-${i}`}
            className={`term-bootseq-line term-bootseq-line--${line.tag}`}
            style={{ animationDelay: "0ms" }}
          >
            <span className="term-bootseq-bracket">[</span>
            <span className="term-bootseq-tag">
              {line.tag === "done" ? "done" : "  ok"}
            </span>
            <span className="term-bootseq-bracket">]</span>
            <span className="term-bootseq-text">{line.text}</span>
          </div>
        ))}
      </div>

      <div className="term-bootseq-bar-wrap" aria-hidden>
        <div className="term-bootseq-bar-track">
          <div
            className="term-bootseq-bar-fill"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <span className="term-bootseq-pct">{Math.min(100, Math.round(progress))}%</span>
      </div>
    </div>
  );
}

function Prompt({ cwd = "~" }) {
  return (
    <span className="prompt" aria-hidden>
      <span className="prompt-user">arwah</span>
      <span className="prompt-at">@</span>
      <span className="prompt-host">portfolio</span>
      <span className="prompt-sep">:</span>
      <span className="prompt-path">{cwd}</span>
      <span className="prompt-arrow">❯</span>
    </span>
  );
}

function BootBanner({ onQuick }) {
  return (
    <div className="term-boot">
      <div className="term-boot-glow" aria-hidden />
      <div className="term-boot-header">
        <pre className="term-ascii" aria-hidden>
          {`  █████╗ ██████╗ ██╗    ██╗ █████╗ ██╗  ██╗
 ██╔══██╗██╔══██╗██║    ██║██╔══██╗██║  ██║
 ███████║██████╔╝██║ █╗ ██║███████║███████║
 ██╔══██║██╔══██╗██║███╗██║██╔══██║██╔══██║
 ██║  ██║██║  ██║╚███╔███╔╝██║  ██║██║  ██║
 ╚═╝  ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝`}
        </pre>
        <div className="term-boot-badge-row">
          <span className="term-pill term-pill--cyan">PortfolioOS</span>
          <span className="term-pill term-pill--soft">ReactShell</span>
          <span className="term-pill term-pill--green">online</span>
        </div>
      </div>

      <div className="term-boot-card">
        <div className="term-boot-row">
          <span className="term-k">user</span>
          <span className="term-v">arwah · cybersecurity student</span>
        </div>
        <div className="term-boot-row">
          <span className="term-k">focus</span>
          <span className="term-v term-v--accent">purple team · CTF · engineering</span>
        </div>
        <div className="term-boot-row">
          <span className="term-k">hint</span>
          <span className="term-v">
            type <code>help</code> or click a command below
          </span>
        </div>
      </div>

      <div className="term-quick">
        {QUICK_CMDS.map((cmd) => (
          <button
            key={cmd}
            type="button"
            className="term-chip"
            onClick={(e) => {
              e.stopPropagation();
              onQuick?.(cmd);
            }}
          >
            {cmd}
          </button>
        ))}
      </div>

      <div className="term-divider" />
    </div>
  );
}

function NeofetchBlock({ data }) {
  return (
    <div className="term-neofetch">
      <pre className="term-ascii term-ascii--sm">{data.banner.join("\n")}</pre>
      <div className="term-neofetch-fields">
        <div className="term-neofetch-title">
          <span className="term-v term-v--accent">{data.fields[0]?.[1] ?? "arwah"}</span>
          <span className="term-muted">@portfolio</span>
        </div>
        <div className="term-divider term-divider--short" />
        {data.fields.map(([key, value]) => (
          <div className="term-boot-row" key={key}>
            <span className="term-k">{key}</span>
            <span className="term-v">{value}</span>
          </div>
        ))}
        <div className="term-palette" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function HelpBlock({ data }) {
  return (
    <div className="term-help">
      <div className="term-help-head">
        <span className="term-help-title">{data.title}</span>
        <span className="term-help-sub">{data.subtitle}</span>
      </div>
      <div className="term-help-grid">
        {data.items.map((item) => (
          <div className="term-help-row" key={item.cmd}>
            <code className="term-help-cmd">{item.cmd}</code>
            <span className="term-help-desc">{item.desc}</span>
          </div>
        ))}
      </div>
      {data.hint && (
        <p className="term-boot-hint">
          <span className="term-hint-label">try</span>
          {data.hint}
        </p>
      )}
    </div>
  );
}

function LsBlock({ data }) {
  return (
    <div className="term-ls">
      {data.entries.map((e) => (
        <span key={e.name} className={`term-ls-item term-ls-item--${e.type}`}>
          {e.type === "dir" ? (
            <span className="term-ls-icon" aria-hidden>
              ▸
            </span>
          ) : (
            <span className="term-ls-icon term-ls-icon--file" aria-hidden>
              ·
            </span>
          )}
          {e.name}
        </span>
      ))}
    </div>
  );
}

function ProfileCard({ data }) {
  return (
    <div className="term-card">
      <div className="term-card-head">
        <span className="term-card-title">{data.title}</span>
        {data.badge && <span className="term-pill term-pill--green">{data.badge}</span>}
      </div>
      {data.lines?.map((row, i) => (
        <div className="term-boot-row" key={i}>
          <span className="term-k">{row.label}</span>
          <span className={`term-v ${row.accent ? "term-v--accent" : ""}`}>
            {row.value}
          </span>
        </div>
      ))}
      {data.body && <p className="term-card-body">{data.body}</p>}
    </div>
  );
}

function SkillsBlock({ data }) {
  return (
    <div className="term-skills">
      <div className="term-skills-cols">
        {data.columns.map((col) => (
          <div className="term-skill-panel" key={col.title}>
            <div className="term-skill-panel-title">{col.title}</div>
            <ul className="term-skill-list">
              {col.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {data.meta?.map((row) => (
        <div className="term-boot-row" key={row.label}>
          <span className="term-k">{row.label}</span>
          <span className="term-v">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function ContactBlock({ data }) {
  return (
    <div className="term-contact">
      {data.links.map((link) => (
        <a
          key={link.label}
          className="term-contact-row"
          href={link.href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="term-k">{link.label}</span>
          <span className="term-v term-v--link">{link.display}</span>
          <span className="term-contact-arrow" aria-hidden>
            ↗
          </span>
        </a>
      ))}
      {data.tip && (
        <p className="term-boot-hint">
          <span className="term-hint-label">tip</span>
          {data.tip}
        </p>
      )}
    </div>
  );
}

function ProjectsBlock({ data }) {
  return (
    <div className="term-projects">
      <div className="term-help-head">
        <span className="term-help-title">{data.title}</span>
        <span className="term-help-sub">{data.subtitle}</span>
      </div>
      <div className="term-project-list">
        {data.items.map((p, i) => (
          <div className="term-project-row" key={p.id}>
            <span className="term-project-idx">{String(i + 1).padStart(2, "0")}</span>
            <span className="term-project-name">{p.title}</span>
            <span className="term-project-meta">
              {p.year} · {p.projectType}
            </span>
          </div>
        ))}
      </div>
      {data.hint && (
        <p className="term-boot-hint">
          <span className="term-hint-label">open</span>
          {data.hint}
        </p>
      )}
    </div>
  );
}

function LineOutput({ line, onQuick }) {
  if (line.kind === "boot") return <BootBanner onQuick={onQuick} />;
  if (line.kind === "neofetch") return <NeofetchBlock data={line} />;
  if (line.kind === "help") return <HelpBlock data={line} />;
  if (line.kind === "ls") return <LsBlock data={line} />;
  if (line.kind === "profile") return <ProfileCard data={line} />;
  if (line.kind === "skills") return <SkillsBlock data={line} />;
  if (line.kind === "contact") return <ContactBlock data={line} />;
  if (line.kind === "projects") return <ProjectsBlock data={line} />;

  if (line.type === "command") {
    return (
      <div className="terminal-line terminal-line--cmd">
        <Prompt />
        <span className="typed-command">{line.text}</span>
      </div>
    );
  }

  if (!line.text) return null;

  return (
    <pre className={`terminal-output terminal-output--${line.variant || "default"}`}>
      {line.text}
    </pre>
  );
}

function formatClock(d) {
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function Terminal({ onOpenWindow }) {
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const bootTimersRef = useRef([]);

  const [lines, setLines] = useState([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [focused, setFocused] = useState(true);
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const [suggestions, setSuggestions] = useState([]);
  const [booting, setBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [bootVisible, setBootVisible] = useState(0);
  const [bootDoneFlash, setBootDoneFlash] = useState(false);

  function clearBootTimers() {
    bootTimersRef.current.forEach((id) => {
      clearTimeout(id);
      clearInterval(id);
    });
    bootTimersRef.current = [];
  }

  function finishBoot() {
    setBootProgress(100);
    setBootVisible(BOOT_LOG.length);
    setBootDoneFlash(true);
    const t = setTimeout(() => {
      setBooting(false);
      setLines([BOOT_BANNER]);
      // focus after banner mounts
      requestAnimationFrame(() => inputRef.current?.focus());
    }, 220);
    bootTimersRef.current.push(t);
  }

  function startBoot() {
    clearBootTimers();
    setBooting(true);
    setBootDoneFlash(false);
    setBootProgress(0);
    setBootVisible(0);
    setLines([]);
    setInput("");
    setSuggestions([]);

    if (prefersReducedMotion()) {
      finishBoot();
      return;
    }

    BOOT_LOG.forEach((entry, index) => {
      const t = setTimeout(() => {
        setBootVisible(index + 1);
        setBootProgress(((index + 1) / BOOT_LOG.length) * 92);
      }, entry.at);
      bootTimersRef.current.push(t);
    });

    // smooth progress ease toward end
    const tickEvery = 40;
    let elapsed = 0;
    const progressTimer = setInterval(() => {
      elapsed += tickEvery;
      const p = Math.min(96, (elapsed / BOOT_DURATION_MS) * 100);
      setBootProgress((prev) => Math.max(prev, p));
      if (elapsed >= BOOT_DURATION_MS) {
        clearInterval(progressTimer);
      }
    }, tickEvery);
    bootTimersRef.current.push(progressTimer);

    const end = setTimeout(() => {
      clearInterval(progressTimer);
      finishBoot();
    }, BOOT_DURATION_MS);
    bootTimersRef.current.push(end);
  }

  useEffect(() => {
    startBoot();
    return () => clearBootTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only boot
  }, []);

  useEffect(() => {
    if (!booting) inputRef.current?.focus();
  }, [booting]);

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: booting ? "auto" : "smooth",
    });
  }, [lines, input, bootVisible, booting]);

  const suggestionLabel = useMemo(() => {
    if (!input.trim() || suggestions.length !== 1) return "";
    const s = suggestions[0];
    if (!s.startsWith(input.trim().toLowerCase())) return "";
    return s.slice(input.trim().length);
  }, [input, suggestions]);

  function updateSuggestions(value) {
    const token = value.trim().toLowerCase().split(/\s+/)[0] || "";
    if (!token || value.includes(" ")) {
      setSuggestions([]);
      return;
    }
    setSuggestions(COMMAND_NAMES.filter((c) => c.startsWith(token)).slice(0, 6));
  }

  function runCommand(command) {
    if (booting) return;
    const trimmed = command.trim();
    if (!trimmed) return;

    const result = executeCommand(trimmed, onOpenWindow);

    if (result.clear) {
      setLines([BOOT_BANNER]);
    } else {
      const next = [{ type: "command", text: trimmed }];

      if (result.kind) {
        next.push(result);
      } else if (result.output !== undefined && result.output !== "") {
        next.push({
          type: "output",
          text: result.output,
          variant: result.variant || "default",
        });
      }

      setLines((prev) => [...prev, ...next]);
    }

    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInput("");
    setSuggestions([]);
  }

  function submitCommand() {
    runCommand(input);
  }

  function onKeyDown(e) {
    if (booting) {
      e.preventDefault();
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      if (suggestions.length === 1) {
        setInput(suggestions[0] + " ");
        setSuggestions([]);
      } else if (suggestions.length > 1) {
        setInput(suggestions[0]);
        setSuggestions(suggestions.slice(0, 1));
      } else {
        const token = input.trim().toLowerCase();
        const matches = COMMAND_NAMES.filter((c) => c.startsWith(token));
        if (matches.length === 1) {
          setInput(matches[0] + " ");
        } else if (matches.length > 1) {
          setSuggestions(matches.slice(0, 6));
        }
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      submitCommand();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const next =
        historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next]);
      updateSuggestions(history[next]);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex < 0) return;
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(-1);
        setInput("");
        setSuggestions([]);
      } else {
        setHistoryIndex(next);
        setInput(history[next]);
        updateSuggestions(history[next]);
      }
      return;
    }

    if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setLines([BOOT_BANNER]);
    }

    if (e.key === "c" && (e.ctrlKey || e.metaKey) && input) {
      e.preventDefault();
      setLines((prev) => [
        ...prev,
        { type: "command", text: input + "^C" },
      ]);
      setInput("");
      setSuggestions([]);
    }
  }

  return (
    <div
      className={`terminal ${focused ? "terminal--focused" : ""} ${booting ? "terminal--booting" : ""}`}
      onClick={() => {
        if (!booting) inputRef.current?.focus();
      }}
    >
      <div className="term-chrome">
        <div className="term-chrome-left">
          <span
            className={`term-dot ${booting ? "term-dot--boot" : "term-dot--live"}`}
          />
          <span className="term-chrome-title">PortfolioOS Shell</span>
          <span className="term-chrome-badge">v1.0</span>
        </div>
        <div className="term-chrome-right">
          {booting ? (
            <span className="term-chrome-meta">initializing…</span>
          ) : (
            <>
              <span className="term-chrome-meta">
                <span className="term-chrome-key">tab</span> complete
              </span>
              <span className="term-chrome-meta term-chrome-meta--dim">
                <span className="term-chrome-key">⌃L</span> clear
              </span>
            </>
          )}
        </div>
      </div>

      <div className="terminal-scroll" ref={scrollRef}>
        {booting && (
          <BootSequence
            progress={bootProgress}
            visibleCount={bootVisible}
            done={bootDoneFlash}
          />
        )}

        {!booting &&
          lines.map((line, index) => (
            <div key={index} className="term-block">
              <LineOutput line={line} onQuick={runCommand} />
            </div>
          ))}

        {!booting && (
          <div className="terminal-line terminal-line--active">
            <input
              ref={inputRef}
              className="hidden-input"
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                updateSuggestions(e.target.value);
              }}
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Terminal input"
              disabled={booting}
            />
            <Prompt />
            <span className="typed-command">
              {input}
              {suggestionLabel && (
                <span className="term-ghost">{suggestionLabel}</span>
              )}
            </span>
            <span className={`cursor ${focused ? "cursor--on" : ""}`} />
          </div>
        )}

        {!booting && suggestions.length > 1 && (
          <div className="term-suggest" role="listbox" aria-label="Suggestions">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="term-suggest-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setInput(s + " ");
                  setSuggestions([]);
                  inputRef.current?.focus();
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="term-status">
        <span
          className={`term-status-item ${booting ? "term-status-item--boot" : ""}`}
        >
          <span
            className={`term-status-dot ${booting ? "term-status-dot--boot" : ""}`}
          />
          {booting ? "booting" : "ready"}
        </span>
        <span className="term-status-sep" aria-hidden>
          │
        </span>
        <span className="term-status-item term-status-item--dim">~/home/arwah</span>
        <span className="term-status-sep" aria-hidden>
          │
        </span>
        <span className="term-status-item term-status-item--dim">
          {history.length} cmd
        </span>
        <span className="term-status-spacer" />
        <span className="term-status-item term-status-item--clock">{clock}</span>
      </div>
    </div>
  );
}
