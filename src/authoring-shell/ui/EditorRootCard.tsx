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
		className={twMerge("grid gap-3", className)}
		data-ui={dataUi}
	>
		{children}
	</div>
);
