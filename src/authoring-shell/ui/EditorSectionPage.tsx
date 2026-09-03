import type { PropsWithChildren, ReactNode } from "react";

import { readDataUiFn } from "~/ui/fn/readDataUiFn";

type EditorSectionPageContentMode = "scroll" | "viewport";

/** Owns the one fixed Editor page header and the active route's content viewport. */
export const EditorSectionPage = ({
	children,
	contentMode = "scroll",
	header,
	scrollRestorationId = "editor-section-page",
}: PropsWithChildren<{
	readonly contentMode?: EditorSectionPageContentMode;
	readonly header: ReactNode;
	readonly scrollRestorationId?: string;
}>) => (
	<div
		className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden"
		data-ui="EditorSectionPage"
	>
		<div
			className="ak-editor-page-header px-3 py-3"
			style={{
				viewTransitionName: "arkini-editor-section-navigation",
			}}
		>
			{header}
		</div>
		<div
			className="min-h-0 min-w-0 data-[ui-content-mode=scroll]:overflow-y-auto data-[ui-content-mode=scroll]:overscroll-contain data-[ui-content-mode=scroll]:p-3 data-[ui-content-mode=viewport]:overflow-hidden"
			data-scroll-restoration-id={contentMode === "scroll" ? scrollRestorationId : undefined}
			{...readDataUiFn({
				dataUi: "EditorSectionPageContent",
				state: {
					contentMode,
				},
			})}
		>
			{children}
		</div>
	</div>
);
