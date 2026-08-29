import type { EditorProject } from "~/project-authoring/EditorProject";
import type { GameDiagnosticSchema } from "~/game-config/diagnostic/schema/GameDiagnosticSchema";
import { printEditorGameDiagnosticFn } from "~/editor-build/ui/fn/printEditorGameDiagnosticFn";
import { ButtonLink } from "~/ui/button/Button";

type EditorGameDiagnostic = GameDiagnosticSchema.Type;
type EditorDiagnosticTarget = ReturnType<typeof printEditorGameDiagnosticFn>["targets"][number];

const EditorDiagnosticLink = ({
	projectId,
	target,
}: {
	readonly projectId: string;
	readonly target: EditorDiagnosticTarget;
}) => {
	switch (target.kind) {
		case "item":
			return (
				<ButtonLink
					className="mt-3 w-fit shadow-none"
					to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
					params={{
						projectId,
						itemUid: target.itemUid,
						sectionId: target.sectionId,
					}}
				>
					Open {target.label}
				</ButtonLink>
			);
		case "asset":
			return (
				<ButtonLink
					className="mt-3 w-fit shadow-none"
					to="/editor/$projectId/assets/$resourceId/detail/overview"
					params={{
						projectId,
						resourceId: target.resourceId,
					}}
				>
					Open asset {target.label}
				</ButtonLink>
			);
		case "project":
			return (
				<ButtonLink
					className="mt-3 w-fit shadow-none"
					to="/editor/$projectId/project/$sectionId"
					params={{
						projectId,
						sectionId: target.sectionId,
					}}
				>
					Open {target.label}
				</ButtonLink>
			);
	}
};

/** Renders structured build diagnostics without discarding their actionable editor context. */
export const EditorBuildDiagnostics = ({
	diagnostics,
	project,
}: {
	readonly diagnostics: ReadonlyArray<EditorGameDiagnostic>;
	readonly project: Pick<EditorProject, "projectId" | "config" | "resources">;
}) => (
	<ul className="mt-4 grid gap-3">
		{diagnostics.map((diagnostic, index) => {
			const printed = printEditorGameDiagnosticFn(diagnostic, project);
			return (
				<li
					key={`${diagnostic.code}-${diagnostic.source ?? "project"}-${diagnostic.path.join(".")}-${index}`}
					className={`rounded-xl border-l-2 p-4 ${diagnostic.severity === "error" ? "border-danger bg-danger/5" : "border-warning bg-warning/5"}`}
				>
					<div className="flex flex-wrap items-start justify-between gap-2">
						<div>
							<h3 className="font-semibold text-foreground">{printed.title}</h3>
							{printed.context === undefined ? null : (
								<p className="mt-0.5 text-xs font-medium text-muted">
									{printed.context}
								</p>
							)}
						</div>
						<span className="text-xs font-semibold uppercase tracking-wider text-muted">
							{printed.severity}
						</span>
					</div>
					<p className="mt-2 text-sm text-foreground">{printed.detail}</p>
					{printed.location === undefined ? null : (
						<p className="mt-2 break-all font-mono text-xs text-muted">
							{printed.code} · {printed.location}
						</p>
					)}
					{printed.targets.length === 0 ? null : (
						<div className="flex flex-wrap gap-2">
							{printed.targets.map((target) => (
								<EditorDiagnosticLink
									key={`${target.kind}-${target.label}`}
									projectId={project.projectId}
									target={target}
								/>
							))}
						</div>
					)}
				</li>
			);
		})}
	</ul>
);
