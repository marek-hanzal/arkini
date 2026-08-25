import type { PropsWithChildren } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectProvider } from "~/bridge/editor/EditorProjectProvider";
import { EditorProjectReplacementBoundary } from "~/ui/editor/EditorProjectReplacementBoundary";
import { EditorShell } from "~/ui/editor/EditorShell";
import { EditorProjectResourceUrlProvider } from "~/ui/resource/editor/EditorResourceUrlProvider";
import { EditorVersionRestoreAction } from "~/ui/version/editor/EditorVersionRestoreAction";

/** Owns the project-scoped editor providers and workspace shell. */
export const EditorProjectWorkspace = ({
	children,
	project,
}: PropsWithChildren<{
	readonly project: EditorProject;
}>) => (
	<EditorProjectProvider loaded={project}>
		<EditorVersionRestoreAction projectId={project.projectId} />
		<EditorProjectReplacementBoundary>
			<EditorProjectResourceUrlProvider>
				<EditorShell>{children}</EditorShell>
			</EditorProjectResourceUrlProvider>
		</EditorProjectReplacementBoundary>
	</EditorProjectProvider>
);
