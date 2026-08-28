import type {
	EditorProjectCandidate,
	EditorProjectOwnership,
} from "~/bridge/editor/EditorProjectCandidate";
import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import { useEffect, useState } from "react";
import { EditorArkpackImportButton } from "~/ui/arkpack/editor/EditorArkpackImportButton";
import { BackButton } from "~/ui/button/BackButton";
import { Button } from "~/ui/button/Button";
import { LinkButton } from "~/ui/button/LinkButton";
import { EditorRecentProjects } from "~/ui/editor/EditorRecentProjects";
import { EditorProjectDeleteDialog } from "~/ui/editor/EditorProjectDeleteDialog";
import { useEditorWelcomeActions } from "~/ui/editor/useEditorWelcomeActions";

export namespace EditorWelcome {
	export interface Props {
		readonly recentProjects: ReadonlyArray<EditorProjectCandidate>;
	}
}

interface ProjectToDelete {
	readonly ownership: EditorProjectOwnership;
	readonly project: EditorProjectDescriptor;
}

/** Starts or reopens one local editor project. */
export const EditorWelcome = ({ recentProjects }: EditorWelcome.Props) => {
	const [projectToDelete, setProjectToDelete] = useState<ProjectToDelete | null>(null);
	const [deleteRequested, setDeleteRequested] = useState(false);
	const actions = useEditorWelcomeActions({
		exitBlocked: projectToDelete !== null,
	});

	useEffect(() => {
		if (
			projectToDelete === null ||
			!actions.deletedProjectIds.has(projectToDelete.project.projectId)
		)
			return;
		setProjectToDelete(null);
		setDeleteRequested(false);
	}, [
		actions.deletedProjectIds,
		projectToDelete,
	]);

	return (
		<>
			<div
				className="grid min-h-0 gap-5"
				data-ui="EditorWelcome"
			>
				<header className="flex items-center justify-between gap-3">
					<h1
						id="editor-welcome-title"
						className="text-2xl font-semibold"
					>
						Editor
					</h1>
					<LinkButton
						disabled={actions.blocked}
						cursorIntent={actions.refreshingProjects ? "progress" : undefined}
						className="inline-flex items-center gap-1.5"
						onClick={() => void actions.refreshProjects()}
					>
						<span className="icon-[lucide--refresh-cw] size-4" />
						{actions.refreshingProjects ? "Refreshing…" : "Refresh"}
					</LinkButton>
				</header>

				<section className="grid gap-3 sm:grid-cols-3">
					<EditorArkpackImportButton
						blocked={actions.blocked}
						pending={actions.active === "import-arkpack"}
						onFile={actions.importArkpackFile}
					/>
					<Button
						disabled={actions.blocked}
						cursorIntent={actions.active === "import-json" ? "progress" : undefined}
						className="min-h-44 flex-col gap-3 rounded-2xl"
						onClick={actions.importJsonDirectory}
					>
						<span className="icon-[lucide--file-json-2] size-9 text-accent" />
						<span className="text-lg">
							{actions.active === "import-json" ? "Opening…" : "Open folder"}
						</span>
						<span className="text-xs font-medium opacity-75">
							Use an existing Editor project in place
						</span>
					</Button>
					<Button
						disabled={actions.blocked}
						cursorIntent={actions.active === "create" ? "progress" : undefined}
						className="min-h-44 flex-col gap-3 rounded-2xl"
						onClick={actions.createProject}
					>
						<span className="icon-[lucide--file-plus-2] size-9" />
						<span className="text-lg">
							{actions.active === "create" ? "Creating…" : "New project"}
						</span>
						<span className="text-xs font-medium opacity-75">
							Start with an empty project
						</span>
					</Button>
				</section>

				{actions.error === undefined ? null : (
					<p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						{actions.error instanceof Error
							? actions.error.message
							: String(actions.error)}
					</p>
				)}
				{actions.projectRefreshError === undefined ? null : (
					<div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						<p>Recent projects could not be refreshed.</p>
						<p className="mt-1 text-xs opacity-80">
							{actions.projectRefreshError instanceof Error
								? actions.projectRefreshError.message
								: String(actions.projectRefreshError)}
						</p>
						<Button
							disabled={actions.refreshingProjects}
							cursorIntent={actions.refreshingProjects ? "progress" : undefined}
							className="mt-3"
							onClick={() => void actions.refreshProjects()}
						>
							{actions.refreshingProjects ? "Refreshing…" : "Refresh projects"}
						</Button>
					</div>
				)}

				<EditorRecentProjects
					blocked={actions.blocked}
					onDeleteProject={(project, ownership) => {
						setDeleteRequested(false);
						setProjectToDelete({
							ownership,
							project,
						});
					}}
					onOpenProjectFolder={actions.openProjectFolder}
					projects={recentProjects.filter(
						(candidate) =>
							candidate.type === "invalid" ||
							!actions.deletedProjectIds.has(candidate.project.projectId),
					)}
				/>

				<footer className="flex justify-center">
					<BackButton
						disabled={actions.blocked}
						cursorIntent={actions.active === "exit" ? "progress" : undefined}
						onClick={actions.exit}
					>
						{actions.active === "exit" ? "Returning…" : "Back"}
					</BackButton>
				</footer>
			</div>
			{projectToDelete === null ? null : (
				<EditorProjectDeleteDialog
					error={deleteRequested ? actions.error : undefined}
					ownership={projectToDelete.ownership}
					pending={actions.active === "delete-project"}
					project={projectToDelete.project}
					onCancel={() => {
						setDeleteRequested(false);
						setProjectToDelete(null);
					}}
					onConfirm={() => {
						setDeleteRequested(true);
						actions.deleteProject(projectToDelete.project.projectId);
					}}
				/>
			)}
		</>
	);
};
