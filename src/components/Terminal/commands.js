import { getNeofetch } from "./neofetch";
import { works } from "../../data/works";

function out(text, variant = "default") {
  return { output: text, variant };
}

const HELP = [
  { cmd: "help", desc: "Show this command map" },
  { cmd: "whoami", desc: "Identity & role" },
  { cmd: "about", desc: "Short bio dump" },
  { cmd: "skills", desc: "Tools & domains" },
  { cmd: "contact", desc: "Ways to reach me" },
  { cmd: "projects", desc: "List portfolio projects" },
  { cmd: "ls", desc: "List home directory" },
  { cmd: "pwd", desc: "Print working directory" },
  { cmd: "date", desc: "System clock" },
  { cmd: "neofetch", desc: "System overview" },
  { cmd: "open <name>", desc: "Launch app or project" },
  { cmd: "github", desc: "Open GitHub profile" },
  { cmd: "clear", desc: "Clear the terminal" },
];

export const COMMAND_NAMES = [
  "help",
  "whoami",
  "about",
  "skills",
  "contact",
  "projects",
  "ls",
  "pwd",
  "date",
  "neofetch",
  "open",
  "github",
  "clear",
  "echo",
];

export function executeCommand(raw, onOpenWindow) {
  const parts = raw.trim().split(/\s+/);
  const command = (parts[0] || "").toLowerCase();
  const args = parts.slice(1);

  if (!command) {
    return { output: "", variant: "default" };
  }

  switch (command) {
    case "help":
      return {
        kind: "help",
        title: "Command map",
        subtitle: "Enter a command · Tab to autocomplete · ↑↓ for history",
        items: HELP,
        hint: "neofetch · whoami · open about · projects",
      };

    case "whoami":
      return {
        kind: "profile",
        title: "identity",
        badge: "active",
        lines: [
          { label: "name", value: "arwah" },
          { label: "role", value: "Cybersecurity Student", accent: true },
          { label: "track", value: "Purple Team Aspirant" },
          { label: "status", value: "building · breaking · defending" },
          { label: "locale", value: "Cyber University of Uzbekistan" },
        ],
      };

    case "about":
      return {
        kind: "profile",
        title: "about",
        badge: "bio",
        body:
          "I'm an 18-year-old cybersecurity student with a passion for understanding how systems work, break, and can be defended. Interests span pentesting, forensics, malware analysis, threat detection, and security engineering — plus software & automation (Python, Java, Kotlin) and CTFs. This OS-style portfolio mirrors how I learn: by exploring.",
        lines: [
          { label: "age", value: "18" },
          { label: "interests", value: "pentest · forensics · detection · RE" },
          { label: "also", value: "Python · Java · Kotlin · CTFs" },
        ],
      };

    case "skills":
      return {
        kind: "skills",
        columns: [
          {
            title: "offensive",
            items: ["web security", "reverse engineering", "cryptography"],
          },
          {
            title: "defensive",
            items: ["detection", "incident response", "forensics"],
          },
        ],
        meta: [
          { label: "languages", value: "Python · Java · Kotlin · JavaScript" },
          { label: "domains", value: "networking · linux · threat analysis" },
          { label: "habit", value: "CTF competitions · hands-on labs" },
        ],
      };

    case "contact":
      return {
        kind: "contact",
        links: [
          {
            label: "github",
            display: "github.com/arwvah",
            href: "https://github.com/arwvah",
          },
          {
            label: "telegram",
            display: "t.me/yaa_sosed",
            href: "https://t.me/yaa_sosed",
          },
          {
            label: "x/twitter",
            display: "x.com/arwahcxz",
            href: "https://x.com/arwahcxz",
          },
          {
            label: "steam",
            display: "steamcommunity.com/id/arwahhh",
            href: "https://steamcommunity.com/id/arwahhh",
          },
          {
            label: "reddit",
            display: "u/arwvah",
            href: "https://www.reddit.com/user/arwvah",
          },
        ],
        tip: "Use `github` to open the profile, or click any row above.",
      };

    case "projects":
      return {
        kind: "projects",
        title: "Portfolio projects",
        subtitle: `${works.length} entries · open by name`,
        items: works.map((w) => ({
          id: w.id,
          title: w.title,
          year: w.year,
          projectType: w.projectType,
        })),
        hint: "open nexus | open oasis | open lumina",
      };

    case "pwd":
      return out("/home/arwah", "muted");

    case "ls":
      return {
        kind: "ls",
        entries: [
          { name: "Desktop/", type: "dir" },
          { name: "Documents/", type: "dir" },
          { name: "Projects/", type: "dir" },
          { name: "about.txt", type: "file" },
          { name: "skills.txt", type: "file" },
          { name: "contact.txt", type: "file" },
          { name: "resume.pdf", type: "file" },
        ],
      };

    case "date":
      return out(new Date().toString(), "muted");

    case "echo":
      return out(args.join(" ") || "", "default");

    case "github":
      window.open("https://github.com/arwvah", "_blank");
      return out("→ opening github.com/arwvah …", "success");

    case "neofetch":
      return getNeofetch();

    case "clear":
      return { clear: true };

    case "open": {
      if (!args.length) {
        return out(
          "usage: open <name>\nexamples: open about · open notes · open nexus",
          "warning"
        );
      }

      const target = args.join(" ").toLowerCase();

      if (target === "about" || target === "about-me") {
        onOpenWindow?.("about-me", { type: "app", id: "about-me" });
        return out("→ launching About Me …", "success");
      }

      if (target === "notes") {
        onOpenWindow?.("notes", { type: "app", id: "notes" });
        return out("→ launching Notes …", "success");
      }

      if (target === "terminal") {
        onOpenWindow?.("terminal", { type: "app", id: "terminal" });
        return out("→ spawning another shell …", "success");
      }

      const project = works.find(
        (w) =>
          w.id.toLowerCase() === target ||
          w.title.toLowerCase() === target ||
          w.slug?.toLowerCase() === target
      );

      if (project) {
        onOpenWindow?.(project.id, { type: "project", data: project });
        return out(`→ opening project “${project.title}” …`, "success");
      }

      return out(`open: nothing found named “${target}”`, "error");
    }

    default:
      return out(
        `${command}: command not found\nrun \`help\` for the command map.`,
        "error"
      );
  }
}
