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
	readonly title?: ReactNode;
}) => (
	<header
		className="flex min-w-0 flex-wrap items-center gap-3"
		data-ui="EditorSectionNavigation"
	>
		{leading}
		{tabs === undefined ? null : (
			<div
				className="min-w-0 shrink-0"
				data-ui="EditorSectionNavigationTabs"
			>
				{tabs}
			</div>
		)}
		{tabs === undefined || title === undefined ? null : (
			<span
				className="h-6 w-px shrink-0 bg-line"
				data-ui="EditorSectionNavigationSeparator"
			/>
		)}
		{title === undefined ? null : (
			<div
				className="min-w-0"
				data-ui="EditorSectionNavigationTitle"
			>
				{title}
			</div>
		)}
		{action === undefined ? null : (
			<div
				className="ml-auto shrink-0"
				data-ui="EditorSectionNavigationAction"
			>
				{action}
			</div>
		)}
	</header>
);
