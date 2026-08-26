import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import { ButtonLink } from "~/ui/button/Button";

const formatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

export namespace EditorRecentProjects {
	export interface Props {
		readonly blocked: boolean;
		readonly onDeleteProject: (project: EditorProjectDescriptor) => void;
		readonly projects: ReadonlyArray<EditorProjectDescriptor>;
	}
}

/** Renders canonical projects in repository-supplied recent order. */
export const EditorRecentProjects = ({
	blocked,
	onDeleteProject,
	projects,
}: EditorRecentProjects.Props) => {
	if (projects.length === 0) return null;
	return (
		<section
			className="grid gap-3 border-t border-line pt-5"
			aria-labelledby="editor-recent-title"
			data-ui="EditorRecentProjects"
		>
			<header className="flex items-center justify-between gap-3">
				<h2
					id="editor-recent-title"
					className="text-sm font-semibold uppercase tracking-wider text-muted"
				>
					Recent
				</h2>
				<span className="text-xs text-subtle">{projects.length}</span>
			</header>
			<div className="ak-list grid gap-2">
				{projects.map((project) => (
					<div
						key={project.projectId}
						className="ak-list-row flex min-w-0 items-center"
					>
						<ButtonLink
							to="/editor/$projectId/editor/items/list"
							params={{
								projectId: project.projectId,
							}}
							aria-disabled={blocked}
							cursorIntent={blocked ? "progress" : undefined}
							className="min-h-0 min-w-0 flex-1 justify-start gap-3 rounded-none border-0 bg-transparent px-4 py-3 text-left shadow-none hover:border-transparent hover:bg-transparent active:bg-transparent"
						>
							<span className="icon-[lucide--folder-kanban] size-5 shrink-0 text-accent" />
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-semibold">
									{project.title}
								</span>
								<span className="mt-1 block truncate text-xs text-subtle">
									{project.projectId} · v{project.version}
								</span>
							</span>
						</ButtonLink>
						<button
							type="button"
							disabled={blocked}
							className="grid size-8 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-subtle transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-subtle"
							data-ui="EditorRecentProjectDelete"
							title={`Delete ${project.title}`}
							onClick={() => onDeleteProject(project)}
						>
							<span className="icon-[lucide--trash-2] size-4" />
						</button>
						<ButtonLink
							to="/editor/$projectId/editor/items/list"
							params={{
								projectId: project.projectId,
							}}
							aria-disabled={blocked}
							cursorIntent={blocked ? "progress" : undefined}
							className="min-h-0 shrink-0 gap-3 rounded-none border-0 bg-transparent px-4 py-3 shadow-none hover:border-transparent hover:bg-transparent active:bg-transparent"
						>
							<time
								dateTime={new Date(project.updatedAtMs).toISOString()}
								className="shrink-0 text-xs text-muted"
							>
								{formatter.format(project.updatedAtMs)}
							</time>
							<span className="icon-[lucide--chevron-right] size-4 shrink-0 text-subtle" />
						</ButtonLink>
					</div>
				))}
			</div>
		</section>
	);
};
