import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import { ButtonLink } from "~/ui/button/Button";

const formatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

export namespace EditorRecentProjects {
	export interface Props {
		readonly blocked: boolean;
		readonly projects: ReadonlyArray<EditorProjectDescriptor>;
	}
}

/** Renders manifest-backed projects in the order supplied by the workspace authority. */
export const EditorRecentProjects = ({ blocked, projects }: EditorRecentProjects.Props) => {
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
					<ButtonLink
						key={project.projectId}
						to="/editor/$projectId/editor"
						params={{ projectId: project.projectId }}
						aria-disabled={blocked}
						cursorIntent={blocked ? "progress" : undefined}
						className="ak-list-row min-h-0 w-full justify-start gap-3 rounded-xl px-4 py-3 text-left"
					>
						<span className="icon-[lucide--folder-kanban] size-5 shrink-0 text-accent" />
						<span className="min-w-0 flex-1">
							<span className="block truncate text-sm font-semibold">{project.title}</span>
							<span className="mt-1 block truncate text-xs text-subtle">
								{project.projectId}
								{project.game === undefined ? "" : ` · ${project.game}`}
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
				))}
			</div>
		</section>
	);
};
