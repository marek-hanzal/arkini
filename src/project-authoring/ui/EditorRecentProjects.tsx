import { ChevronRight, FolderKanban, FolderX, Trash2 } from "lucide-react";

import type {
	ProjectCandidate,
	ProjectOwnership,
} from "~/project-authoring/schema/ProjectCandidateSchema";
import type { ProjectDescriptor } from "~/project-authoring/schema/ProjectDescriptorSchema";
import { Button, ButtonLink } from "~/ui/ui/Button";

const formatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

interface EditorRecentProjectsProps {
	readonly blocked: boolean;
	readonly onDeleteProject: (project: ProjectDescriptor, ownership: ProjectOwnership) => void;
	readonly onOpenProjectFolder: (root: string) => void;
	readonly projects: ReadonlyArray<ProjectCandidate>;
}

/** Renders canonical projects in repository-supplied recent order. */
export const EditorRecentProjects = ({
	blocked,
	onDeleteProject,
	onOpenProjectFolder,
	projects,
}: EditorRecentProjectsProps) => {
	if (projects.length === 0) return null;
	return (
		<section
			className="grid gap-3 border-t border-line pt-5"
			data-ui="EditorRecentProjects"
		>
			<header className="flex items-center justify-between gap-3">
				<h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
					Recent
				</h2>
				<span className="text-xs text-subtle">{projects.length}</span>
			</header>
			<div className="ak-list grid gap-2">
				{projects.map((candidate) =>
					candidate.type === "invalid" ? (
						<div
							key={candidate.root}
							className="ak-list-row flex min-w-0 items-center gap-3 px-4 py-3"
							data-ui="EditorInvalidProject"
						>
							<FolderX className="size-5 shrink-0 text-danger" />
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-semibold">
									{candidate.title}
								</span>
								<span className="mt-1 block break-all text-xs text-subtle">
									{candidate.root}
								</span>
								<span className="mt-1 block text-xs text-danger">
									{candidate.validationError}
								</span>
							</span>
							<Button
								disabled={blocked}
								className="min-h-0 shrink-0 px-3 py-2"
								onClick={() => onOpenProjectFolder(candidate.root)}
							>
								Open folder
							</Button>
						</div>
					) : (
						<div
							key={candidate.project.projectId}
							className="ak-list-row flex min-w-0 items-center"
							data-project-ownership={candidate.ownership}
							data-ui="EditorRecentProject"
						>
							<ButtonLink
								to="/editor/$projectId/editor/items/list"
								params={{
									projectId: candidate.project.projectId,
								}}
								disabled={blocked}
								cursorIntent={blocked ? "progress" : undefined}
								className="min-h-0 min-w-0 flex-1 justify-start gap-3 rounded-none border-0 bg-transparent px-4 py-3 text-left shadow-none hover:border-transparent hover:bg-transparent active:bg-transparent"
							>
								<FolderKanban className="size-5 shrink-0 text-accent" />
								<span className="min-w-0 flex-1">
									<span className="flex min-w-0 items-center gap-2">
										<span className="truncate text-sm font-semibold">
											{candidate.project.title}
										</span>
										<span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
											{candidate.ownership === "managed"
												? "Managed"
												: "Custom"}
										</span>
									</span>
									<span className="mt-1 block truncate text-xs text-subtle">
										{candidate.project.projectId} · v{candidate.project.version}
									</span>
								</span>
							</ButtonLink>
							<button
								type="button"
								disabled={blocked}
								className="grid size-8 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-subtle transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-subtle"
								data-ui="EditorRecentProjectDelete"
								title={`Delete ${candidate.project.title}`}
								onClick={() =>
									onDeleteProject(candidate.project, candidate.ownership)
								}
							>
								<Trash2 className="size-4" />
							</button>
							<ButtonLink
								to="/editor/$projectId/editor/items/list"
								params={{
									projectId: candidate.project.projectId,
								}}
								disabled={blocked}
								cursorIntent={blocked ? "progress" : undefined}
								className="min-h-0 shrink-0 gap-3 rounded-none border-0 bg-transparent px-4 py-3 shadow-none hover:border-transparent hover:bg-transparent active:bg-transparent"
							>
								<time
									dateTime={new Date(candidate.project.updatedAtMs).toISOString()}
									className="shrink-0 text-xs text-muted"
								>
									{formatter.format(candidate.project.updatedAtMs)}
								</time>
								<ChevronRight className="size-4 shrink-0 text-subtle" />
							</ButtonLink>
						</div>
					),
				)}
			</div>
		</section>
	);
};
