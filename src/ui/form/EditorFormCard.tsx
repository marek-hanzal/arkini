import type { PropsWithChildren } from "react";

import { EditorRootCard } from "~/ui/editor/EditorRootCard";

/** Provides the single root surface shared by every editor form. */
export const EditorFormCard = ({
	children,
	className,
}: PropsWithChildren<{
	readonly className?: string;
}>) => (
	<EditorRootCard
		className={className}
		dataUi="EditorFormCard"
	>
		{children}
	</EditorRootCard>
);
