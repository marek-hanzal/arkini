import type { GameDiagnosticSchema } from "~/game-config-diagnostic/schema/GameDiagnosticSchema";
import type { Project } from "~/project-authoring/type/Project";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Scrollable } from "~/ui/ui/Scrollable";

import { EditorBuildDiagnostics } from "./EditorBuildDiagnostics";

interface EditorBuildValidationProps {
	readonly diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>;
	readonly project: Project;
	readonly version: string;
	readonly onDismissFn: (() => void) | undefined;
}

const readFindingCountFn = (count: number, singular: string, plural: string) =>
	`${count} ${count === 1 ? singular : plural}`;

const readValidationSummaryFn = (diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>) => {
	const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
	const warningCount = diagnostics.length - errorCount;

	return [
		errorCount === 0
			? undefined
			: readFindingCountFn(errorCount, "blocking error", "blocking errors"),
		warningCount === 0 ? undefined : readFindingCountFn(warningCount, "warning", "warnings"),
	]
		.filter((count): count is string => count !== undefined)
		.join(" · ");
};

/** Owns the dismissible, internally scrolling output of one Build validation. */
export const EditorBuildValidation = ({
	diagnostics,
	project,
	version,
	onDismissFn,
}: EditorBuildValidationProps) => (
	<article
		className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-5"
		data-ui="EditorBuildValidation"
	>
		<header className="flex shrink-0 items-start justify-between gap-4">
			<div className="min-w-0">
				<h2 className="text-lg font-semibold">Validation findings</h2>
				<p className="mt-1 text-sm text-muted">
					Version <strong className="font-semibold text-foreground">v{version}</strong>
					{" · "}
					{readValidationSummaryFn(diagnostics)}
				</p>
			</div>
			{onDismissFn === undefined ? null : (
				<LinkButton
					className="shrink-0"
					data-ui="EditorBuildValidationDismiss"
					onClick={onDismissFn}
				>
					Dismiss
				</LinkButton>
			)}
		</header>

		<Scrollable className="mt-4 min-h-0 flex-1 pr-1">
			<EditorBuildDiagnostics
				diagnostics={diagnostics}
				project={project}
			/>
		</Scrollable>
	</article>
);
