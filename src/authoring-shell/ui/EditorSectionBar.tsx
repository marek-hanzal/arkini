import type { PropsWithChildren, ReactNode } from "react";

export const editorSectionLinkClassName =
	"inline-flex shrink-0 items-center px-2 py-2 text-sm font-medium text-muted no-underline hover:bg-accent/10 hover:text-accent hover:no-underline data-[ui-selected=true]:bg-accent/10 data-[ui-selected=true]:text-accent";

/** Keeps section links separate from primary actions, with optional help always last. */
export const EditorSectionBar = ({
	children,
	actions,
	help,
}: PropsWithChildren<{
	readonly actions?: ReactNode;
	readonly help?: ReactNode;
}>) => (
	<div
		className="flex min-w-0 items-center gap-3 border-t border-line px-3 text-sm"
		data-ui="EditorSectionBar"
	>
		<nav className="min-w-0 overflow-x-auto overscroll-x-contain">
			<div className="flex min-w-max items-center gap-1">{children}</div>
		</nav>
		<div className="ml-auto flex shrink-0 items-center gap-3">
			{actions}
			{help}
		</div>
	</div>
);
