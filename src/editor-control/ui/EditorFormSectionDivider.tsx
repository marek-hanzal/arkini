import type { ReactNode } from "react";

import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";

interface EditorFormSectionDividerProps {
	readonly action?: ReactNode;
	readonly description?: ReactNode;
	readonly required?: boolean;
	readonly title: string;
	readonly variant?: "primary" | "secondary";
}

/** Owns the heading row only; the containing section owns vertical spacing. */
export const EditorFormSectionDivider = ({
	action,
	description,
	required = false,
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
				<h2 className="text-xl font-semibold">{title}</h2>
			) : (
				<h3 className="text-lg font-semibold">{title}</h3>
			)}
			{required ? <span className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
			{description === undefined ? null : <EditorInfoTooltip content={description} />}
		</div>
		<span className="min-w-0 flex-1 border-t border-line/70" />
		{action === undefined ? null : <div className="shrink-0">{action}</div>}
	</header>
);
