import type { PropsWithChildren } from "react";

import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";

/** Provides a consistent root-object surface shared by editor forms. */
export const EditorFormCard = ({ children }: PropsWithChildren) => (
	<EditorRootCard dataUi="EditorFormCard">{children}</EditorRootCard>
);
