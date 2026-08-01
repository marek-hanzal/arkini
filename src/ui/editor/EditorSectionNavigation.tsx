import type { PropsWithChildren } from "react";

/** Keeps every editor detail header and its optional tab row on one compact rhythm. */
export const EditorSectionNavigation = ({ children }: PropsWithChildren) => (
	<div
		className="grid gap-3"
		data-ui="EditorSectionNavigation"
	>
		{children}
	</div>
);
