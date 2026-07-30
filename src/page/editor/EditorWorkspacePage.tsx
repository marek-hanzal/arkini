import type { PropsWithChildren } from "react";

import { EditorShell } from "~/ui/editor/EditorShell";

export const EditorWorkspacePage = ({ children }: PropsWithChildren) => (
	<EditorShell>{children}</EditorShell>
);
