import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

interface MarkdownRendererProps {
  content: string;
}

// Extend sanitize schema to preserve id attributes on headings for TOC anchors
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    h2: [...(defaultSchema.attributes?.h2 || []), "id"],
    h3: [...(defaultSchema.attributes?.h3 || []), "id"],
    h4: [...(defaultSchema.attributes?.h4 || []), "id"],
    code: [...(defaultSchema.attributes?.code || []), "className"],
  },
};

export function MarkdownRenderer({
  content,
}: MarkdownRendererProps): React.JSX.Element {
  return (
    <article className="prose max-w-none text-foreground leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, [rehypeSanitize, sanitizeSchema]]}
        components={{
          h2: ({ ...props }) => (
            <h2
              className="text-2xl font-bold tracking-tight text-foreground mt-10 mb-4 pb-2 border-b border-border scroll-mt-24"
              {...props}
            />
          ),
          h3: ({ ...props }) => (
            <h3
              className="text-xl font-semibold tracking-tight text-foreground mt-8 mb-3 scroll-mt-24"
              {...props}
            />
          ),
          p: ({ ...props }) => (
            <p
              className="text-foreground text-base leading-7 mb-5"
              {...props}
            />
          ),
          ul: ({ ...props }) => (
            <ul
              className="list-disc list-inside space-y-2 mb-5 pl-2 text-foreground"
              {...props}
            />
          ),
          ol: ({ ...props }) => (
            <ol
              className="list-decimal list-inside space-y-2 mb-5 pl-2 text-foreground"
              {...props}
            />
          ),
          li: ({ ...props }) => (
            <li className="text-foreground leading-7" {...props} />
          ),
          blockquote: ({ ...props }) => (
            <blockquote
              className="border-l-4 border-primary pl-4 py-1 my-6 italic text-foreground-muted bg-surface-muted rounded-r"
              {...props}
            />
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <pre className="p-4 rounded-lg bg-surface-muted border border-border overflow-x-auto my-6 text-sm">
                  <code className="text-foreground font-mono" {...props}>
                    {children}
                  </code>
                </pre>
              );
            }
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-surface-muted text-primary text-sm font-mono border border-border"
                {...props}
              >
                {children}
              </code>
            );
          },
          a: ({ ...props }) => (
            <a
              className="text-primary hover:underline font-medium underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          table: ({ ...props }) => (
            <div className="overflow-x-auto my-6 border border-border rounded-lg">
              <table
                className="w-full text-left border-collapse text-sm"
                {...props}
              />
            </div>
          ),
          th: ({ ...props }) => (
            <th
              className="border-b border-border bg-surface-muted p-3 font-semibold text-foreground"
              {...props}
            />
          ),
          td: ({ ...props }) => (
            <td
              className="border-b border-border p-3 text-foreground"
              {...props}
            />
          ),
          hr: () => <hr className="my-8 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
