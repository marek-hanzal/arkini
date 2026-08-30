import { FileJson2, FilePlus2, RefreshCw } from "lucide-react";

import type {
	EditorProjectCandidate,
	EditorProjectOwnership,
} from "~/project-authoring/schema/EditorProjectCandidateSchema";
import type { EditorProjectDescriptor } from "~/project-authoring/schema/EditorProjectDescriptorSchema";
import { useEffect, useState } from "react";
import { EditorArkpackImportButton } from "~/arkpack/ui/editor/EditorArkpackImportButton";
import { BackButton } from "~/ui/button/BackButton";
import { Button } from "~/ui/button/Button";
import { LinkButton } from "~/ui/button/LinkButton";
import { EditorRecentProjects } from "~/project-authoring/ui/EditorRecentProjects";
import { EditorProjectDeleteDialog } from "~/project-authoring/ui/EditorProjectDeleteDialog";
import { useEditorWelcomeActions } from "~/project-authoring/ui/useEditorWelcomeActions";

interface EditorWelcomeProps {
	readonly recentProjects: ReadonlyArray<EditorProjectCandidate>;
}

interface ProjectToDelete {
	readonly ownership: EditorProjectOwnership;
	readonly project: EditorProjectDescriptor;
}

/** Starts or reopens one local editor project. */
export const EditorWelcome = ({ recentProjects }: EditorWelcomeProps) => {
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
						<RefreshCw className="size-4" />
						Refresh
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
						<FileJson2 className="size-9 text-accent" />
						<span className="text-lg">Open folder</span>
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
						<FilePlus2 className="size-9" />
						<span className="text-lg">New project</span>
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
							Refresh projects
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
					/>
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
