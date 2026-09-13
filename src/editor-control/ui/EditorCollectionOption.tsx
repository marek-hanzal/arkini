import type { ReactNode } from "react";

/** Shared collection option: identity and metadata above its visual item references. */
export const EditorCollectionOption = ({
	label,
	details,
	children,
}: {
	readonly label: string;
	readonly details?: ReactNode;
	readonly children: ReactNode;
}) => (
	<span
		className="grid min-w-0 flex-1 gap-1.5"
		data-ui="EditorCollectionOption"
	>
		<span className="flex min-w-0 flex-wrap items-center gap-2">
			<span className="truncate text-sm font-semibold text-foreground">{label}</span>
			{details}
		</span>
		<span className="flex min-w-0 flex-wrap items-center gap-2">{children}</span>
	</span>
);
