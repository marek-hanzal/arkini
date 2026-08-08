import type { PropsWithChildren } from "react";

import { EditorRootCard } from "~/ui/editor/EditorRootCard";

/** Provides a consistent root-object surface shared by editor forms. */
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
