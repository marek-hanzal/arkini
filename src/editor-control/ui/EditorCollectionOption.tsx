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
		className="grid min-w-0 flex-1 gap-1.5 overflow-hidden"
		data-ui="EditorCollectionOption"
	>
		<span className="flex min-w-0 items-center gap-2 overflow-hidden">
			<span className="min-w-0 truncate text-sm font-semibold text-foreground">{label}</span>
			{details === undefined ? null : (
				<span className="min-w-0 shrink truncate text-xs text-subtle">{details}</span>
			)}
		</span>
		<span className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
			{children}
		</span>
	</span>
);
