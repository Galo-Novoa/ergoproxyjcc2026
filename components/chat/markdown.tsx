import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const CITATION_GROUP = /\[F(\d+(?:\s*[,;]\s*F?\d+)*)\]/g

/** Convierte [F1] y [F1, F2] en enlaces internos hacia el panel de fuentes del mismo mensaje. */
function linkCitations(text: string, prefix: string) {
  return text.replace(CITATION_GROUP, (_match, group: string) =>
    group
      .split(/[,;]/)
      .map((n) => n.replace(/\D/g, ''))
      .filter(Boolean)
      .map((n) => `[F${n}](#${prefix}-${n})`)
      .join(' '),
  )
}

export function Markdown({
  children,
  citationPrefix,
}: {
  children: string
  citationPrefix?: string
}) {
  const text = citationPrefix ? linkCitations(children, citationPrefix) : children
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed [&>*:first-child]:mt-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h3 className="text-base font-semibold text-balance" {...props} />,
          h2: (props) => <h3 className="text-base font-semibold text-balance" {...props} />,
          h3: (props) => <h4 className="font-semibold text-balance" {...props} />,
          p: (props) => <p className="text-pretty" {...props} />,
          ul: (props) => <ul className="flex list-disc flex-col gap-1 pl-5" {...props} />,
          ol: (props) => <ol className="flex list-decimal flex-col gap-1 pl-5" {...props} />,
          a: ({ href, ...props }) =>
            citationPrefix && href?.startsWith(`#${citationPrefix}-`) ? (
              <a
                href={href}
                aria-label={`Ir a la fuente ${props.children}`}
                className="mx-0.5 inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 align-baseline text-xs font-medium text-primary no-underline hover:bg-primary/20"
                {...props}
              />
            ) : (
              <a
                href={href}
                className="font-medium text-primary underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
                {...props}
              />
            ),
          blockquote: (props) => (
            <blockquote className="border-l-2 pl-3 text-muted-foreground" {...props} />
          ),
          pre: (props) => (
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs" {...props} />
          ),
          code: ({ className, ...props }) => (
            <code
              className={
                className ? `${className} font-mono` : 'rounded bg-muted px-1 py-0.5 font-mono text-xs'
              }
              {...props}
            />
          ),
          table: (props) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs" {...props} />
            </div>
          ),
          th: (props) => <th className="border-b px-2 py-1 font-semibold" {...props} />,
          td: (props) => <td className="border-b px-2 py-1" {...props} />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
