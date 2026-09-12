import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

/** Provides the root-object content surface shared by editor forms and details. */
export const EditorRootCard = ({
	children,
	className,
	dataUi = "EditorRootCard",
	...props
}: ComponentProps<"div"> & {
	readonly dataUi?: string;
}) => (
	<div
		{...props}
		className={twMerge(
			"grid gap-5 rounded-2xl border border-l-2 border-line-strong bg-surface-raised/60 p-[var(--ak-panel-padding)]",
			className,
		)}
		data-ui={dataUi}
	>
		{children}
	</div>
);
