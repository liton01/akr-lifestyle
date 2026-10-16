import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders admin-managed long-form text with a tiny, safe formatting subset:
 *   "## Heading", "### Subheading", "- bullet", blank-line paragraphs and **bold**.
 * Everything is rendered as React text nodes — no HTML is ever injected.
 */
export function RichText({ content, className }: { content: string; className?: string }) {
  const blocks = content.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={cn("prose-akr", className)}>
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={index}>
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <Fragment key={index}>
            {groupLines(lines).map((group, gi) => {
              if (group.type === "h2") return <h2 key={gi}>{inline(group.text)}</h2>;
              if (group.type === "h3") return <h3 key={gi}>{inline(group.text)}</h3>;
              if (group.type === "ul")
                return (
                  <ul key={gi}>
                    {group.items.map((item, ii) => (
                      <li key={ii}>{inline(item)}</li>
                    ))}
                  </ul>
                );
              return <p key={gi}>{inline(group.text)}</p>;
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

type Group = { type: "h2" | "h3" | "p"; text: string } | { type: "ul"; items: string[] };

function groupLines(lines: string[]): Group[] {
  const groups: Group[] = [];
  for (const line of lines) {
    if (line.startsWith("### ")) groups.push({ type: "h3", text: line.slice(4) });
    else if (line.startsWith("## ")) groups.push({ type: "h2", text: line.slice(3) });
    else if (/^\s*[-*]\s+/.test(line)) {
      const last = groups.at(-1);
      const item = line.replace(/^\s*[-*]\s+/, "");
      if (last?.type === "ul") last.items.push(item);
      else groups.push({ type: "ul", items: [item] });
    } else {
      const last = groups.at(-1);
      if (last?.type === "p") last.text += ` ${line}`;
      else groups.push({ type: "p", text: line });
    }
  }
  return groups;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}
