import type { PropsWithChildren } from "react";

export const editorSectionTabClassName =
	"min-h-9 rounded-lg border border-l-2 border-accent/20 border-l-accent/35 bg-accent/5 px-3 py-2 text-sm text-foreground shadow-none hover:bg-accent/10";

export const editorSectionTabActiveClassName =
	"border-accent/40 border-l-accent/75 bg-accent/15 text-accent hover:bg-accent/20";

/** Provides one compact route-backed tab row without owning domain state. */
export const EditorSectionTabs = ({
	children,
	label,
}: PropsWithChildren<{
	readonly label: string;
}>) => (
	<nav
		className="min-w-0 overflow-x-auto overscroll-x-contain"
		aria-label={label}
		data-ui="EditorSectionTabs"
	>
		<div
			className="flex min-w-max items-center gap-2 py-1"
			role="tablist"
		>
			{children}
		</div>
	</nav>
);
