import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorGameDiagnostic } from "~/bridge/arkpack/editor/readEditorBuildDiagnosticsFx";
import { EditorDiagnosticLink } from "~/ui/arkpack/editor/EditorDiagnosticLink";
import { printEditorGameDiagnosticFx } from "~/ui/arkpack/editor/printEditorGameDiagnosticFx";

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
			const printed = RendererRuntime.runSync(
				printEditorGameDiagnosticFx(diagnostic, project),
			);
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
