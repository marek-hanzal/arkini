import type { PropsWithChildren } from "react";

/** Provides one compact route-backed tab row without owning domain state. */
export const EditorSectionTabs = ({
	children,
	label,
}: PropsWithChildren<{
	readonly label: string;
}>) => (
	<nav
		className="min-w-0 overflow-x-auto overscroll-x-contain border-b border-line"
		aria-label={label}
		data-ui="EditorSectionTabs"
	>
		<div
			className="flex min-w-max items-end gap-1"
			role="tablist"
		>
			{children}
		</div>
	</nav>
);
