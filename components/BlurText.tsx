import type { ElementType } from "react";

/**
 * Words fade in from a soft blur one after another (after React Bits' BlurText).
 * Rendered on the server and animated with CSS only, so it ships no JavaScript.
 * Long titles cap the stagger so the last word still arrives quickly.
 */
export function BlurText({ text, as: Tag = "span", className }: { text: string; as?: ElementType; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  const step = Math.min(45, 700 / Math.max(words.length, 1));
  return (
    <Tag className={`blur-text${className ? ` ${className}` : ""}`}>
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true" style={{ animationDelay: `${Math.round(i * step)}ms` }}>
          {w}{i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}

/** A soft light sweep across text (after React Bits' ShinyText). CSS only. */
export function ShinyText({ text, className }: { text: string; className?: string }) {
  return <span className={`shiny-text${className ? ` ${className}` : ""}`}>{text}</span>;
}
