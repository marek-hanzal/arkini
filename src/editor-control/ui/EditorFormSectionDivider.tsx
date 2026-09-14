import type { ReactNode } from "react";

import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";

interface EditorFormSectionDividerProps {
	readonly action?: ReactNode;
	readonly description?: ReactNode;
	readonly title: string;
	readonly variant?: "primary" | "secondary";
}

/** Owns the heading row only; the containing section owns vertical spacing. */
export const EditorFormSectionDivider = ({
	action,
	description,
	title,
	variant = "primary",
}: EditorFormSectionDividerProps) => (
	<header
		className="flex min-w-0 items-center gap-3"
		data-ui="EditorFormSectionDivider"
		data-variant={variant}
	>
		<div className="flex shrink-0 items-center gap-1">
			{variant === "primary" ? (
				<h2 className="text-base font-semibold">{title}</h2>
			) : (
				<h3 className="text-sm font-semibold">{title}</h3>
			)}
			{description === undefined ? null : <EditorInfoTooltip content={description} />}
		</div>
		<span className="min-w-0 flex-1 border-t border-line/70" />
		{action === undefined ? null : <div className="shrink-0">{action}</div>}
	</header>
);
