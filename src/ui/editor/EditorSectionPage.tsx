import type { PropsWithChildren, ReactNode } from "react";

/** Keeps routed editor tabs fixed while only their active section body scrolls. */
export const EditorSectionPage = ({
	children,
	tabs,
}: PropsWithChildren<{
	readonly tabs: ReactNode;
}>) => (
	<div
		className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3"
		data-ui="EditorSectionPage"
	>
		<div
			className="relative z-10 px-3 pt-3"
			style={{
				viewTransitionName: "arkini-editor-section-navigation",
			}}
		>
			{tabs}
		</div>
		<div className="min-h-0 overflow-y-auto overscroll-contain">
			<div className="w-full px-3 pb-3">{children}</div>
		</div>
	</div>
);
