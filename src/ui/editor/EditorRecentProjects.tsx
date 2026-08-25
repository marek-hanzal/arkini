import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import { Button, ButtonLink } from "~/ui/button/Button";

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
						className="flex min-w-0"
					>
						<ButtonLink
							to="/editor/$projectId/editor/items/list"
							params={{
								projectId: project.projectId,
							}}
							aria-disabled={blocked}
							cursorIntent={blocked ? "progress" : undefined}
							className="ak-list-row min-h-0 min-w-0 flex-1 justify-start gap-3 rounded-r-none px-4 py-3 text-left"
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
							<time
								dateTime={new Date(project.updatedAtMs).toISOString()}
								className="shrink-0 text-xs text-muted"
							>
								{formatter.format(project.updatedAtMs)}
							</time>
							<span className="icon-[lucide--chevron-right] size-4 shrink-0 text-subtle" />
						</ButtonLink>
						<Button
							disabled={blocked}
							cursorIntent={blocked ? "progress" : undefined}
							className="ak-list-row min-h-0 shrink-0 rounded-l-none border-l-0 px-4 text-danger"
							data-ui="EditorRecentProjectDelete"
							title={`Delete ${project.title}`}
							onClick={() => onDeleteProject(project)}
						>
							<span className="icon-[lucide--trash-2] size-4" />
						</Button>
					</div>
				))}
			</div>
		</section>
	);
};
