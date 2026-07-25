"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@daromsart/ui";

export interface MessageContentProps {
  text: string;
  /** Markdown rendu pour l'assistant ; texte brut pour l'utilisateur. */
  markdown?: boolean;
  className?: string;
}

/**
 * Affiche le contenu d'un message. Sans rendu Markdown, le modèle laisse
 * apparaître les `**` / listes « en dur » — d'où ce composant partagé.
 */
export function MessageContent({ text, markdown = false, className }: MessageContentProps) {
  if (!markdown) {
    return <div className={cn("whitespace-pre-wrap", className)}>{text}</div>;
  }

  return (
    <div className={cn("space-y-2 [&_:first-child]:mt-0 [&_:last-child]:mb-0", className)}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => (
            <h1 className="font-heading text-base font-semibold">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-heading text-sm font-semibold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-heading text-sm font-medium">{children}</h3>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline-offset-2 hover:underline"
            >
              {children}
            </a>
          ),
          code: ({ children, className: codeClassName }) => {
            const isBlock = Boolean(codeClassName);
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-md bg-background/60 p-3 font-mono text-xs">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[0.85em]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
