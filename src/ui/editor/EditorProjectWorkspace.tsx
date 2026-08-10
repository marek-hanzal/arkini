import type { PropsWithChildren } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectProvider } from "~/bridge/editor/EditorProjectProvider";
import { EditorShell } from "~/ui/editor/EditorShell";
import { EditorProjectResourceUrlProvider } from "~/ui/resource/editor/EditorResourceUrlProvider";

/** Owns the project-scoped editor providers and workspace shell. */
export const EditorProjectWorkspace = ({
	children,
	project,
}: PropsWithChildren<{
	readonly project: EditorProject;
}>) => (
	<EditorProjectProvider loaded={project}>
		<EditorProjectResourceUrlProvider>
			<EditorShell>{children}</EditorShell>
		</EditorProjectResourceUrlProvider>
	</EditorProjectProvider>
);
