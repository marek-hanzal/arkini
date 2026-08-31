import type { PropsWithChildren } from "react";

/** Owns the renderer viewport. Children must fit inside it rather than growing the document. */
export function Canvas({ children }: PropsWithChildren) {
	return (
		<div
			className="relative size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground"
			data-ui="Canvas"
			style={{
				containerType: "size",
			}}
		>
			{children}
		</div>
	);
}
