import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Markdown({ children }: { children: string }) {
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
          a: (props) => (
            <a
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
        {children}
      </ReactMarkdown>
    </div>
  )
}
