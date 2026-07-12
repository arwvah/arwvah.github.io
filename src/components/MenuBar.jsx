import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function MenuBar({ theme, onToggleTheme }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const timeLabel = now.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <header className="menubar">
      <div className="menubar-left">
        <div className="menubar-brand">
          <span className="menubar-brand-dot" aria-hidden />
          <span>PortfolioOS</span>
        </div>
        <nav className="menubar-nav" aria-label="Desktop menu">
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
          <span>Go</span>
        </nav>
      </div>

      <div className="menubar-right">
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <time className="menubar-time" dateTime={now.toISOString()}>
          {timeLabel}
        </time>
      </div>
    </header>
  );
}
