import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorUnsavedChangesDialog } from "~/authoring-shell/ui/EditorUnsavedChangesDialog";
import { EditorWorkspaceNavigation } from "~/authoring-shell/ui/EditorWorkspaceNavigation";
import { useEditorActiveWorkspace } from "~/authoring-shell/ui/useEditorActiveWorkspace";
import { useEditorNavigationBlocker } from "~/authoring-shell/ui/useEditorNavigationBlocker";
import { useEditorShellCommands } from "~/authoring-shell/ui/useEditorShellCommands";
import { useEditorWorkspaceShortcuts } from "~/authoring-shell/ui/useEditorWorkspaceShortcuts";
import { useEditorWorkspaceTransition } from "~/authoring-shell/ui/useEditorWorkspaceTransition";

/** Keeps editor-wide navigation stable while child tools replace only the content surface. */
export const EditorShell = ({ children }: PropsWithChildren) => {
	const project = useEditorProject();
	const activeWorkspace = useEditorActiveWorkspace(project.projectId);
	const navigationBlocker = useEditorNavigationBlocker();
	const commands = useEditorShellCommands({
		projectId: project.projectId,
	});
	const transition = useEditorWorkspaceTransition({
		projectId: project.projectId,
	});
	useEditorWorkspaceShortcuts({
		enabled:
			!commands.exit.pending && !commands.refresh.pending && !navigationBlocker.promptOpen,
		projectId: project.projectId,
	});

	return (
		<div
			className="grid h-dvh min-h-0 grid-cols-[auto_minmax(0,1fr)] overflow-hidden bg-surface text-foreground"
			data-ui="EditorShell"
			style={{
				viewTransitionName: "arkini-editor-shell",
			}}
		>
			<EditorWorkspaceNavigation
				activeWorkspace={activeWorkspace}
				exitDisabled={commands.exit.disabled}
				exitPending={commands.exit.pending}
				onExit={commands.exit.close}
				onRefresh={commands.refresh.refresh}
				projectId={project.projectId}
				refreshDisabled={commands.refresh.disabled}
				refreshPending={commands.refresh.pending}
				refreshTooltip={commands.refresh.tooltip}
				transitioningWorkspace={transition.workspace}
			/>
			<main
				className="min-h-0 min-w-0 overflow-hidden bg-surface"
				data-ui="EditorContent"
				style={{
					viewTransitionName: "arkini-editor-content",
				}}
			>
				{children}
			</main>
			<EditorUnsavedChangesDialog />
		</div>
	);
};
