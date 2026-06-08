"use client";

import React, { type ReactNode, type ReactElement, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// GitHub-style slugify: lowercase, strip punctuation, spaces -> '-'
function slugify(input: ReactNode): string {
  const text = React.Children.toArray(input)
    .map((node) => {
      if (typeof node === "string") return node;
      if (typeof node === "number") return String(node);
      if (node && typeof node === "object" && "props" in node) {
        return slugify((node as { props: { children: ReactNode } }).props.children);
      }
      return "";
    })
    .join("");
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// First / last column widths based on total column count.
// Goal: last column is for short labels (e.g. "Purpose", "Location"),
// middle columns hold long descriptions, so middle gets the most space.
function getColWidths(colCount: number): number[] {
  if (colCount === 2) return [30, 70];
  if (colCount === 3) return [25, 50, 25];
  if (colCount === 4) return [25, 30, 30, 15];
  // Fallback: equal distribution
  return Array(colCount).fill(100 / colCount);
}

function countCellChildren(children: ReactNode): number {
  return React.Children.toArray(children).filter((c) => {
    if (!isValidElement(c)) return false;
    const t = (c as ReactElement).type;
    return t === "th" || t === "td";
  }).length;
}

export function LegalMarkdownText({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 id={slugify(children)} className="text-2xl font-bold mt-8 mb-4 text-[#111] dark:text-[#f5f5f5]">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 id={slugify(children)} className="text-xl font-semibold mt-6 mb-3 scroll-mt-20 text-[#111] dark:text-[#f5f5f5]">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 id={slugify(children)} className="text-lg font-semibold mt-4 mb-2 text-[#111] dark:text-[#f5f5f5]">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 id={slugify(children)} className="text-base font-semibold mt-3 mb-2 text-[#111] dark:text-[#f5f5f5]">{children}</h4>
        ),
        p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
        ul: ({ children }) => (
          <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code
                className="rounded bg-black/5 px-1.5 py-0.5 text-sm dark:bg-white/10"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-3 overflow-x-auto rounded-lg bg-black/5 p-4 text-sm dark:bg-white/10">
            {children}
          </pre>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        hr: () => <hr className="my-6 border-black/10 dark:border-white/15" />,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
            <table className="w-full table-fixed text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-black/5 dark:bg-white/10">{children}</thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => {
          // We don't use table-fixed + colgroup because react-markdown emits
          // a single child for the whole table subtree, and counting columns
          // by walking the rendered tree is unreliable. Instead, we set
          // per-cell width on each <th>/<td> here, where the row reliably
          // knows its own cell count and indices.
          const colCount = countCellChildren(children) || 1;
          const widths = getColWidths(colCount);
          const cells = React.Children.toArray(children).filter((c) =>
            isValidElement(c)
          );
          return (
            <tr className="border-b border-black/6 last:border-0 dark:border-white/10">
              {cells.map((cell, i) => {
                const idx = i < widths.length ? i : widths.length - 1;
                const widthPct = widths[idx];
                return React.cloneElement(
                  cell as ReactElement<{ style?: React.CSSProperties }>,
                  { style: { ...(cell as ReactElement<{ style?: React.CSSProperties }>).props.style, width: `${widthPct}%` } }
                );
              })}
            </tr>
          );
        },
        th: ({ children, style }) => (
          <th
            style={style}
            className="px-4 py-3 text-left align-top font-semibold text-[#25242a] dark:text-[#f5f5f5] [&:first-child]:font-mono [&:first-child]:text-[12px] break-words"
          >
            {children}
          </th>
        ),
        td: ({ children, style }) => (
          <td
            style={style}
            className="px-4 py-3 align-top text-[#3c3841] dark:text-[#d4d4d4] [&:first-child]:font-mono [&:first-child]:text-[12px] break-words"
          >
            {children}
          </td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-4 border-black/15 pl-4 italic text-[#555] dark:border-white/20 dark:text-[#aaa]">
            {children}
          </blockquote>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
