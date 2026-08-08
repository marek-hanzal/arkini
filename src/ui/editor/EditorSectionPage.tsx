import type { PropsWithChildren, ReactNode } from "react";

/** Keeps routed editor tabs fixed while only their active section body scrolls. */
export const EditorSectionPage = ({
	children,
	tabs,
}: PropsWithChildren<{
	readonly tabs: ReactNode;
}>) => (
	<div
		className="h-full min-h-0 overflow-y-auto overscroll-contain"
		data-ui="EditorSectionPage"
	>
		<div
			className="ak-editor-page-header px-3 py-3"
			style={{
				viewTransitionName: "arkini-editor-section-navigation",
			}}
		>
			{tabs}
		</div>
		<div className="w-full px-3 pt-3 pb-3">{children}</div>
	</div>
);
