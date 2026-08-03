import type { ReactNode } from "react";

export const EditorInlineAddStatus = ({
	action,
	description,
	title,
}: {
	readonly action: ReactNode;
	readonly description: string;
	readonly title: string;
}) => (
	<section
		className="ak-list-row flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 overflow-hidden rounded-xl border-b border-l-2 border-line border-l-line/55 px-3 py-5 pl-4"
		data-ui="EditorInlineAddStatus"
	>
		<div className="min-w-0">
			<h3 className="text-lg font-semibold leading-tight text-foreground">{title}</h3>
			<p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>
		</div>
		{action}
	</section>
);
