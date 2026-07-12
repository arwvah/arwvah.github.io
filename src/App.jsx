import { AnimatePresence } from "framer-motion";
import { useState } from "react";

import { works } from "./data/works";
import { useTheme } from "./hooks/useTheme";

import Dock from "./components/Dock";
import DesktopIcon from "./components/DesktopIcon";
import Window from "./components/Window";
import MenuBar from "./components/MenuBar";

import "./App.css";

function App() {
  const { theme, toggleTheme } = useTheme();
  const [openWindows, setOpenWindows] = useState([]);
  const [activeWindow, setActiveWindow] = useState(null);

  const handleOpenWindow = (windowId, content) => {
    if (!openWindows.find((w) => w.id === windowId)) {
      setOpenWindows((prev) => [
        ...prev,
        {
          id: windowId,
          content,
        },
      ]);
    }

    setActiveWindow(windowId);
  };

  const handleCloseWindow = (windowId) => {
    setOpenWindows((prev) => prev.filter((w) => w.id !== windowId));

    if (activeWindow === windowId) {
      const remaining = openWindows.filter((w) => w.id !== windowId);

      setActiveWindow(
        remaining.length ? remaining[remaining.length - 1].id : null
      );
    }
  };

  const handleFocusWindow = (windowId) => {
    setActiveWindow(windowId);
  };

  return (
    <div className="desktop-environment" data-theme-surface={theme}>
      <MenuBar theme={theme} onToggleTheme={toggleTheme} />

      <div className="desktop-overlay" />

      <div className="desktop-area">
        {works.map((work) => (
          <DesktopIcon
            key={work.id}
            item={work}
            onOpen={() =>
              handleOpenWindow(work.id, {
                type: "project",
                data: work,
              })
            }
          />
        ))}
      </div>

      <div className="windows-area">
        <AnimatePresence>
          {openWindows.map((win) => (
            <Window
              key={win.id}
              windowData={win}
              isActive={activeWindow === win.id}
              onClose={() => handleCloseWindow(win.id)}
              onFocus={() => handleFocusWindow(win.id)}
              onOpenWindow={handleOpenWindow}
            />
          ))}
        </AnimatePresence>
      </div>

      <Dock
        onOpenApp={(appId) =>
          handleOpenWindow(appId, {
            type: "app",
            id: appId,
          })
        }
      />

      <div className="dock-blur-strip" />
    </div>
  );
}

export default App;
