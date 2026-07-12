import { motion } from "framer-motion";
import "./Window.css";
import Terminal from "./Terminal/Terminal";

// Put your photo at: src/assets/avatar.jpg (or .png)
// Then update the import path/extension if needed.
import avatarImg from "../assets/hero.jpg";

export default function Window({
  windowData,
  isActive,
  onClose,
  onFocus,
  onOpenWindow,
}) {
  const { id, content } = windowData;

  const isApp = content.type === "app";
  const isProject = content.type === "project";

  const title = isApp
    ? id === "about-me"
      ? "About Me"
      : id === "notes"
        ? "Notes"
        : id === "terminal"
          ? "Terminal"
          : ""
    : content.data.title;

  const isNotes = isApp && id === "notes";
  const isTerminal = isApp && id === "terminal";
  const sizeClass = isNotes
    ? "mac-window--notes"
    : isTerminal
      ? "mac-window--terminal"
      : "";

  const halfW = isNotes ? 190 : isTerminal ? 360 : 300;
  const halfH = isNotes ? 160 : isTerminal ? 260 : 220;

  return (
    <motion.div
      className={`mac-window ${sizeClass} ${isActive ? "active" : ""}`.trim()}
      drag
      dragMomentum={false}
      initial={{
        scale: 0.88,
        opacity: 0,
        x:
          typeof window !== "undefined"
            ? window.innerWidth / 2 - halfW
            : 100,
        y:
          typeof window !== "undefined"
            ? window.innerHeight / 2 - halfH
            : 80,
      }}
      animate={{
        scale: 1,
        opacity: 1,
      }}
      exit={{
        scale: 0.9,
        opacity: 0,
      }}
      transition={{
        type: "spring",
        damping: 26,
        stiffness: 320,
      }}
      onPointerDown={onFocus}
      style={{
        zIndex: isActive ? 100 : 10,
      }}
    >
      <div className="window-titlebar">
        <div className="window-controls">
          <button
            type="button"
            className="win-btn close"
            aria-label="Close window"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />
          <button type="button" className="win-btn min" aria-label="Minimize" />
          <button type="button" className="win-btn max" aria-label="Maximize" />
        </div>

        <div className="window-title">{title}</div>
      </div>

      <div className="window-content">
        {isProject && (
          <div className="project-detail">
            <div
              className="project-header"
              style={{ background: content.data.thumbnail }}
            />

            <div className="project-body">
              <h2>{content.data.title}</h2>

              <div className="project-meta">
                <span className="meta-chip">{content.data.client}</span>
                <span className="meta-chip">{content.data.year}</span>
                <span className="meta-chip">{content.data.projectType}</span>
              </div>

              <p>{content.data.description}</p>

              <div className="project-credits">{content.data.credits}</div>
            </div>
          </div>
        )}

        {isApp && id === "about-me" && (
          <div className="about-me-content">
            <img
              className="avatar-photo"
              src={avatarImg}
              alt="arwah"
              width={108}
              height={108}
            />

            <h2>arwah</h2>

            <p className="role">
              Cybersecurity Student • Purple Team Aspirant • Developer
            </p>

            <p className="bio">
              I&apos;m an 18-year-old cybersecurity student at Cyber University of
              Uzbekistan with a passion for understanding how systems work,
              break, and can be defended. My interests span penetration testing,
              digital forensics, malware analysis, threat detection, and security
              engineering.
            </p>

            <p className="bio">
              Beyond cybersecurity, I enjoy building software and automation
              tools with Python, Java, and Kotlin. I regularly participate in CTF
              competitions where I sharpen my reverse engineering, web security,
              cryptography, and incident response skills through hands-on
              challenges.
            </p>

            <p className="bio bio-closing">
              This portfolio is designed like an operating system because
              that&apos;s how I think: explore, experiment, and learn by
              interacting.
            </p>

            <div className="about-tags">
              <span>Engineering</span>
              <span>Cryptography</span>
              <span>Digital Forensics</span>
              <span>CTF</span>
              <span>Python</span>
              <span>Java</span>
              <span>Kotlin</span>
            </div>
          </div>
        )}

        {isApp && id === "notes" && (
          <div className="notes-content">
            <h3>Reminder</h3>
            <ul>
              <li>Never trust user input.</li>
              <li>Never hardcode secrets.</li>
              <li>Document everything.</li>
              <li>Read the logs before blaming DNS.</li>
              <li>If it works on the first try... investigate.</li>
              <li>Coffee is optional. Backups are not.</li>
            </ul>
          </div>
        )}

        {isApp && id === "terminal" && (
          <div className="terminal-content" style={{ height: "100%" }}>
            <Terminal onOpenWindow={onOpenWindow} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
