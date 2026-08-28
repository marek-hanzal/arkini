import type { PropsWithChildren } from "react";

/** Provides the root-object content surface shared by editor forms and details. */
export const EditorRootCard = ({
	children,
	dataUi = "EditorRootCard",
}: PropsWithChildren<{
	readonly dataUi?: string;
}>) => (
	<div
		className="grid gap-5 rounded-2xl border border-l-2 border-line-strong bg-surface-raised/60 p-[var(--ak-panel-padding)]"
		data-ui={dataUi}
	>
		{children}
	</div>
);
