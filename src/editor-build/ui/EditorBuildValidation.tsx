import { useTranslator } from "~/translation/ui/useTranslator";
import { Tx } from "~/translation/ui/Tx";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
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

const readValidationSummaryFn = (
	diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>,
	labels: {
		readonly error: string;
		readonly errors: string;
		readonly warning: string;
		readonly warnings: string;
	},
) => {
	const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
	const warningCount = diagnostics.length - errorCount;

	return [
		errorCount === 0 ? undefined : readFindingCountFn(errorCount, labels.error, labels.errors),
		warningCount === 0
			? undefined
			: readFindingCountFn(warningCount, labels.warning, labels.warnings),
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
}: EditorBuildValidationProps) => {
	const translator = useTranslator();
	return (
		<EditorRootCard
			className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
			dataUi="EditorBuildValidation"
		>
			<header className="flex shrink-0 items-start justify-between gap-4">
				<div className="min-w-0">
					<h2 className="text-lg font-semibold">
						<Tx label="Validation findings" />
					</h2>
					<p className="mt-1 text-sm text-muted">
						<Tx label="Version" />{" "}
						<strong className="font-semibold text-foreground">v{version}</strong>
						{" · "}
						{readValidationSummaryFn(diagnostics, {
							error: translator.textFn("blocking error"),
							errors: translator.textFn("blocking errors"),
							warning: translator.textFn("warning"),
							warnings: translator.textFn("warnings"),
						})}
					</p>
				</div>
				{onDismissFn === undefined ? null : (
					<LinkButton
						className="shrink-0"
						data-ui="EditorBuildValidationDismiss"
						onClick={onDismissFn}
					>
						<Tx label="Dismiss" />
					</LinkButton>
				)}
			</header>

			<Scrollable className="mt-4 min-h-0 flex-1 pr-1">
				<EditorBuildDiagnostics
					diagnostics={diagnostics}
					project={project}
				/>
			</Scrollable>
		</EditorRootCard>
	);
};
