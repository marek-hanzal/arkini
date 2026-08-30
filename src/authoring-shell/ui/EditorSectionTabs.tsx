import type { PropsWithChildren } from "react";

export const editorSectionTabClassName =
	"min-h-9 rounded-lg border border-b-2 border-accent/20 border-b-accent/35 bg-accent/5 px-3 py-2 text-sm text-foreground shadow-none hover:bg-accent/10 data-[ui-selected=true]:border-accent/40 data-[ui-selected=true]:border-b-accent/75 data-[ui-selected=true]:bg-accent/15 data-[ui-selected=true]:text-accent data-[ui-selected=true]:hover:bg-accent/20";

/** Provides one compact route-backed tab row without owning domain state. */
export const EditorSectionTabs = ({ children }: PropsWithChildren) => (
	<nav
		className="min-w-0 overflow-x-auto overscroll-x-contain"
		data-ui="EditorSectionTabs"
	>
		<div className="flex min-w-max items-center gap-2 py-1">{children}</div>
	</nav>
);
