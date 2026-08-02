import type { ReactNode } from "react";

/** Keeps editor identity, routed tabs, and the primary action in one compact row. */
export const EditorSectionNavigation = ({
	action,
	leading,
	tabs,
	title,
}: {
	readonly action?: ReactNode;
	readonly leading?: ReactNode;
	readonly tabs?: ReactNode;
	readonly title: ReactNode;
}) => (
	<header
		className="flex min-w-0 flex-wrap items-center gap-3"
		data-ui="EditorSectionNavigation"
	>
		{leading}
		<div className="min-w-0 shrink-0">{title}</div>
		<div className="min-w-0 flex-1">{tabs}</div>
		{action}
	</header>
);
