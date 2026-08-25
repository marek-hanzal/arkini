import type { PropsWithChildren } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectProvider } from "~/bridge/editor/EditorProjectProvider";
import { EditorProjectRevisionBoundary } from "~/ui/editor/EditorProjectRevisionBoundary";
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
		<EditorProjectRevisionBoundary>
			<EditorProjectResourceUrlProvider>
				<EditorShell>{children}</EditorShell>
			</EditorProjectResourceUrlProvider>
		</EditorProjectRevisionBoundary>
	</EditorProjectProvider>
);
