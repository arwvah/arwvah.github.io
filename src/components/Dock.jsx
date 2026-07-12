import { motion } from "framer-motion";
import {
  User,
  FileText,
  Send,
  Gamepad2,
  MessageSquare,
  Terminal as TerminalIcon,
} from "lucide-react";
import "./Dock.css";

function GithubIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.09.682-.22.682-.48 0-.24-.01-.87-.015-1.71-2.782.6-3.369-1.34-3.369-1.34-.454-1.16-1.11-1.47-1.11-1.47-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.53 2.341 1.09 2.91.83.09-.647.35-1.09.636-1.34-2.22-.25-4.555-1.11-4.555-4.94 0-1.09.39-1.98 1.029-2.68-.103-.25-.446-1.27.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.59 1.028 2.68 0 3.84-2.339 4.68-4.566 4.93.359.31.678.92.678 1.855 0 1.34-.012 2.42-.012 2.75 0 .27.18.58.688.48A10.01 10.01 0 0 0 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function XIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.722-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function Dock({ onOpenApp }) {
  const appItems = [
    {
      id: "about-me",
      label: "About Me",
      icon: <User size={22} strokeWidth={2} />,
    },
    {
      id: "notes",
      label: "Notes",
      icon: <FileText size={22} strokeWidth={2} />,
    },
    {
      id: "terminal",
      label: "Terminal",
      icon: <TerminalIcon size={22} strokeWidth={2} />,
    },
  ];

  const socialItems = [
    {
      id: "telegram",
      label: "Telegram",
      url: "https://t.me/yaa_sosed",
      icon: <Send size={20} />,
    },
    {
      id: "github",
      label: "GitHub",
      url: "https://github.com/arwvah",
      icon: <GithubIcon size={20} />,
    },
    {
      id: "steam",
      label: "Steam",
      url: "https://steamcommunity.com/id/arwahhh/",
      icon: <Gamepad2 size={20} />,
    },
    {
      id: "reddit",
      label: "Reddit",
      url: "https://www.reddit.com/u/arwvah/s/ekv5D9Qrah",
      icon: <MessageSquare size={20} />,
    },
    {
      id: "twitter",
      label: "Twitter",
      url: "https://x.com/arwahcxz",
      icon: <XIcon size={20} />,
    },
  ];

  return (
    <div className="dock-container">
      <div className="dock">
        {appItems.map((item) => (
          <motion.button
            key={item.id}
            type="button"
            className="dock-item"
            whileHover={{ scale: 1.28, y: -8 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            onClick={() => onOpenApp(item.id)}
            aria-label={item.label}
          >
            {item.icon}
            <span className="dock-tooltip">{item.label}</span>
            <span className="dock-shine" aria-hidden />
          </motion.button>
        ))}

        <div className="dock-separator" />

        {socialItems.map((item) => (
          <motion.a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="dock-item"
            whileHover={{ scale: 1.28, y: -8 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            aria-label={item.label}
          >
            {item.icon}
            <span className="dock-tooltip">{item.label}</span>
            <span className="dock-shine" aria-hidden />
          </motion.a>
        ))}
      </div>
    </div>
  );
}
