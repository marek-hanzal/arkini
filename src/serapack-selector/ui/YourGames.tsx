import { FileJson2, FilePlus2, FolderOpen, PackageOpen, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import type { ProjectCandidate } from "~/project-authoring/schema/ProjectCandidateSchema";
import { ProjectDeleteDialog } from "~/project-authoring/ui/ProjectDeleteDialog";
import { EditorBuildMajorUpdateDialog } from "~/editor-build/ui/EditorBuildMajorUpdateDialog";
import { YourGamesList } from "~/serapack-selector/ui/YourGamesList";
import { useSerapackSelectorActions } from "~/serapack-selector/ui/useSerapackSelectorActions";
import { useYourGamesPlayController } from "~/serapack-selector/ui/useYourGamesPlayController";
import { BackButton } from "~/ui/ui/BackButton";
import { Button } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { LauncherPageLayout } from "~/launcher/ui/LauncherPageLayout";
import { ProjectCreateDialog } from "~/project-authoring/ui/ProjectCreateDialog";
import { useProjectCatalogActions } from "~/project-authoring/ui/useProjectCatalogActions";
import { Tx } from "~/translation/ui/Tx";

interface YourGamesProps {
	readonly projects: ReadonlyArray<ProjectCandidate>;
	readonly projectCatalogError?: unknown;
}

/** Combines installed games and Editor projects in one launcher surface. */
export const YourGames = ({ projects, projectCatalogError }: YourGamesProps) => {
	const [createOpen, setCreateOpenFn] = useState(false);
	const [projectToDelete, setProjectToDeleteFn] = useState<Extract<
		ProjectCandidate,
		{
			type: "valid";
		}
	> | null>(null);
	const [deleteRequested, setDeleteRequestedFn] = useState(false);
	const projectActions = useProjectCatalogActions();
	const play = useYourGamesPlayController(
		projectActions.blocked || createOpen || projectToDelete !== null,
	);
	const actions = useSerapackSelectorActions({
		externallyBlocked:
			projectActions.blocked || createOpen || projectToDelete !== null || play.blocked,
	});
	const blocked = actions.blocked;
	useEffect(() => {
		if (
			projectToDelete === null ||
			!projectActions.deletedProjectIds.has(projectToDelete.project.projectId)
		)
			return;
		setProjectToDeleteFn(null);
		setDeleteRequestedFn(false);
	}, [
		projectActions.deletedProjectIds,
		projectToDelete,
	]);
	const visibleProjects = projects.filter((candidate) =>
		candidate.type === "invalid"
			? !projectActions.dismissedProjectRoots.has(candidate.root)
			: !projectActions.deletedProjectIds.has(candidate.project.projectId),
	);

	return (
		<LauncherPageLayout page="serapacks">
			<div
				className="grid min-h-0 gap-5"
				data-ui="SerapackSelector"
			>
				<header>
					<div className="flex items-center justify-between gap-4">
						<h1 className="text-2xl font-semibold">Your games</h1>
						<div className="flex flex-wrap items-center justify-end gap-4 text-sm">
							<LinkButton
								disabled={blocked}
								cursorIntent={blocked ? "progress" : undefined}
								className="inline-flex items-center gap-1.5"
								onClick={actions.openSerapackDirectoryFn}
							>
								<FolderOpen className="size-4" />
								Open Serapack folder
							</LinkButton>
							<LinkButton
								disabled={blocked}
								cursorIntent={blocked ? "progress" : undefined}
								className="inline-flex items-center gap-1.5"
								onClick={actions.refreshSerapacksFn}
							>
								<RefreshCw className="size-4" />
								Refresh
							</LinkButton>
						</div>
					</div>
					{actions.actionError === undefined ? null : (
						<p className="mt-3 text-sm text-danger">{String(actions.actionError)}</p>
					)}
				</header>

				<section className="grid grid-cols-3 gap-3">
					<Button
						className="min-h-44 flex-col gap-3 rounded-2xl"
						cursorIntent={blocked ? "progress" : undefined}
						data-ui="YourGamesSerapackImport"
						disabled={blocked}
						onClick={() => void actions.uploadFn()}
					>
						<PackageOpen className="size-9 text-accent" />
						<span className="text-lg">
							<Tx label="Import serapack" />
						</span>
						<span className="text-xs font-medium opacity-75">
							<Tx label="Choose an existing .serapack file" />
						</span>
					</Button>
					<Button
						disabled={blocked}
						cursorIntent={
							projectActions.active === "import-json" ? "progress" : undefined
						}
						className="min-h-44 flex-col gap-3 rounded-2xl"
						data-ui="YourGamesOpenProjectFolder"
						onClick={projectActions.importJsonDirectoryFn}
					>
						<FileJson2 className="size-9 text-accent" />
						<span className="text-lg">
							<Tx label="Open folder" />
						</span>
						<span className="text-xs font-medium opacity-75">
							<Tx label="Use an existing Editor project in place" />
						</span>
					</Button>
					<Button
						disabled={blocked}
						cursorIntent={projectActions.active === "create" ? "progress" : undefined}
						className="min-h-44 flex-col gap-3 rounded-2xl"
						data-ui="YourGamesProjectCreateOpen"
						onClick={() => setCreateOpenFn(true)}
					>
						<FilePlus2 className="size-9" />
						<span className="text-lg">
							<Tx label="New project" />
						</span>
						<span className="text-xs font-medium opacity-75">
							<Tx label="Start with an empty project" />
						</span>
					</Button>
				</section>

				{projectActions.error === undefined ? null : (
					<p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						{projectActions.error instanceof Error
							? projectActions.error.message
							: String(projectActions.error)}
					</p>
				)}
				{projectActions.projectRefreshError === undefined ? null : (
					<p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						Recent projects could not be refreshed.
					</p>
				)}
				{play.error === undefined || play.majorUpdate !== undefined ? null : (
					<p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						{play.error instanceof Error ? play.error.message : String(play.error)}
					</p>
				)}
				{projectCatalogError === undefined ? null : (
					<p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						Editor projects could not be loaded: {String(projectCatalogError)}
					</p>
				)}

				<section className="grid gap-3 border-t border-line pt-5">
					<YourGamesList
						blocked={blocked}
						pendingProjectId={play.pendingProjectId}
						projects={visibleProjects}
						state={actions.state}
						onDeleteProjectFn={(candidate) => {
							setDeleteRequestedFn(false);
							setProjectToDeleteFn(candidate);
						}}
						onDismissInvalidProjectFn={projectActions.dismissInvalidProjectFn}
						onOpenEditorSerapackFn={actions.openSerapackInEditorFn}
						onOpenProjectFolderFn={projectActions.openProjectFolderFn}
						onPlayProjectFn={play.playProjectFn}
						onRemoveSerapackFn={actions.removeSerapackFn}
					/>
				</section>

				<footer className="flex justify-center">
					<BackButton
						cursorIntent={blocked ? "progress" : undefined}
						disabled={blocked}
						onClick={actions.requestMainMenuFn}
					>
						Back
					</BackButton>
				</footer>
			</div>
			{createOpen ? (
				<ProjectCreateDialog
					error={projectActions.error}
					pending={projectActions.active === "create"}
					onCancelFn={() => setCreateOpenFn(false)}
					onCreateFn={projectActions.createProjectFn}
				/>
			) : null}
			{projectToDelete === null ? null : (
				<ProjectDeleteDialog
					error={deleteRequested ? projectActions.error : undefined}
					ownership={projectToDelete.ownership}
					pending={projectActions.active === "delete-project"}
					project={projectToDelete.project}
					onCancelFn={() => {
						setDeleteRequestedFn(false);
						setProjectToDeleteFn(null);
					}}
					onConfirmFn={() => {
						setDeleteRequestedFn(true);
						projectActions.deleteProjectFn(projectToDelete.project.projectId);
					}}
				/>
			)}
			{play.majorUpdate === undefined ? null : (
				<EditorBuildMajorUpdateDialog
					confirmation={play.majorUpdate.confirmation}
					error={
						play.error === undefined
							? undefined
							: play.error instanceof Error
								? play.error.message
								: String(play.error)
					}
					pending={play.pendingProjectId !== undefined}
					onCancelFn={play.cancelMajorUpdateFn}
					onConfirmFn={() => void play.confirmMajorUpdateFn()}
				/>
			)}
		</LauncherPageLayout>
	);
};
