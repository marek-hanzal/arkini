import type { PropsWithChildren, ReactNode } from "react";

import { readDataUiFn } from "~/ui/fn/readDataUiFn";

type EditorSectionPageContentMode = "scroll" | "viewport";

/** Owns the one fixed Editor page header and the active route's content viewport. */
export const EditorSectionPage = ({
	children,
	contentMode = "scroll",
	fillContent = false,
	header,
	scrollRestorationId = "editor-section-page",
}: PropsWithChildren<{
	readonly contentMode?: EditorSectionPageContentMode;
	readonly fillContent?: boolean;
	readonly header: ReactNode;
	readonly scrollRestorationId?: string;
}>) => (
	<div
		className="h-full min-h-0 min-w-0 data-[ui-fill-content=true]:flex data-[ui-fill-content=true]:flex-col data-[ui-content-mode=scroll]:overflow-y-auto data-[ui-content-mode=scroll]:overscroll-contain data-[ui-content-mode=viewport]:grid data-[ui-content-mode=viewport]:grid-rows-[auto_minmax(0,1fr)] data-[ui-content-mode=viewport]:overflow-hidden"
		data-scroll-restoration-id={contentMode === "scroll" ? scrollRestorationId : undefined}
		{...readDataUiFn({
			dataUi: "EditorSectionPage",
			state: {
				contentMode,
				fillContent,
			},
		})}
	>
		<div
			className="ak-editor-page-header shrink-0 px-3 py-3"
			style={{
				viewTransitionName: "arkini-editor-section-navigation",
			}}
		>
			{header}
		</div>
		<div
			className="min-w-0 data-[ui-fill-content=true]:flex data-[ui-fill-content=true]:flex-1 data-[ui-fill-content=true]:flex-col data-[ui-content-mode=scroll]:p-3 data-[ui-content-mode=viewport]:min-h-0 data-[ui-content-mode=viewport]:overflow-hidden"
			{...readDataUiFn({
				dataUi: "EditorSectionPageContent",
				state: {
					contentMode,
					fillContent,
				},
			})}
		>
			{children}
		</div>
	</div>
);
