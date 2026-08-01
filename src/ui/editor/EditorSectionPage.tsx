import type { PropsWithChildren, ReactNode } from "react";

/** Keeps routed editor tabs fixed while only their active section body scrolls. */
export const EditorSectionPage = ({
	children,
	tabs,
}: PropsWithChildren<{ readonly tabs: ReactNode }>) => (
	<div
		className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4"
		data-ui="EditorSectionPage"
	>
		{tabs}
		<div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
			<div className="mx-auto w-full max-w-5xl pb-8">{children}</div>
		</div>
	</div>
);
