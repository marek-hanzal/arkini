import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownProps extends Omit<ComponentProps<typeof ReactMarkdown>, "children"> {
	readonly children: string;
}

/** Renders trusted application-authored Markdown without admitting embedded HTML. */
export const Markdown = ({ children, components, ...props }: MarkdownProps) => (
	<div
		className="grid gap-3 text-sm leading-6 text-muted"
		data-ui="Markdown"
	>
		<ReactMarkdown
			{...props}
			skipHtml
			remarkPlugins={[
				remarkGfm,
			]}
			components={{
				h1: ({ children: heading }) => (
					<h1 className="text-xl font-semibold text-foreground">{heading}</h1>
				),
				h2: ({ children: heading }) => (
					<h2 className="text-lg font-semibold text-foreground">{heading}</h2>
				),
				h3: ({ children: heading }) => (
					<h3 className="font-semibold text-foreground">{heading}</h3>
				),
				p: ({ children: paragraph }) => <p>{paragraph}</p>,
				strong: ({ children: strong }) => (
					<strong className="font-semibold text-foreground">{strong}</strong>
				),
				em: ({ children: emphasis }) => <em>{emphasis}</em>,
				ul: ({ children: list }) => <ul className="grid list-disc gap-2 pl-5">{list}</ul>,
				ol: ({ children: list }) => (
					<ol className="grid list-decimal gap-2 pl-5">{list}</ol>
				),
				li: ({ children: item }) => <li>{item}</li>,
				blockquote: ({ children: quote }) => (
					<blockquote className="border-l-2 border-line-strong pl-3">{quote}</blockquote>
				),
				hr: () => <hr className="border-line" />,
				a: ({ children: link, href }) => (
					<a
						className="text-accent underline underline-offset-2"
						href={href}
						rel="noopener noreferrer"
						target="_blank"
					>
						{link}
					</a>
				),
				code: ({ children: code }) => (
					<code className="rounded bg-surface px-1 py-0.5 font-mono text-foreground">
						{code}
					</code>
				),
				...components,
			}}
		>
			{children}
		</ReactMarkdown>
	</div>
);
