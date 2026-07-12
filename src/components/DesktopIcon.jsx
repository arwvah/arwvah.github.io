import { motion } from "framer-motion";
import { Folder } from "lucide-react";
import "./DesktopIcon.css";

export default function DesktopIcon({ item, onOpen }) {
  return (
    <motion.div
      className="desktop-icon"
      drag
      dragMomentum={false}
      initial={{ x: item.x, y: item.y }}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      tabIndex={0}
      role="button"
      aria-label={`Open ${item.title}`}
    >
      <div className="icon-graphic">
        <Folder size={30} strokeWidth={1.75} />
      </div>
      <span className="icon-label">{item.title}</span>
    </motion.div>
  );
}
