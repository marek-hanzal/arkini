import type { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

/** Provides the single root surface shared by every editor form. */
export const EditorFormCard = ({
	children,
	className,
}: PropsWithChildren<{
	readonly className?: string;
}>) => (
	<div
		className={twMerge(
			"grid gap-5 rounded-2xl border border-line bg-surface/70 p-[var(--ak-panel-padding)]",
			className,
		)}
		data-ui="EditorFormCard"
	>
		{children}
	</div>
);
