import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { readGameDiagnosticPresentationFn } from "~/game-config-diagnostic/fn/readGameDiagnosticPresentationFn";
import type { GameDiagnosticSchema } from "~/game-config-diagnostic/schema/GameDiagnosticSchema";
import type { EditorItemSectionId } from "~/item-authoring/type/EditorItemSection";
import { readEditorItemSectionForPathFn } from "~/item-authoring/fn/readEditorItemSectionForPathFn";
import type { EditorProjectSectionId } from "~/project-authoring/type/EditorProjectSections";
import { readEditorProjectSectionForPathFn } from "~/project-authoring/fn/readEditorProjectSectionForPathFn";
import { ButtonLink } from "~/ui/button/Button";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

type EditorGameDiagnostic = GameDiagnosticSchema.Type;

type EditorDiagnosticTarget =
	| {
			readonly kind: "item";
			readonly itemUid: string;
			readonly sectionId: EditorItemSectionId;
			readonly label: string;
	  }
	| {
			readonly kind: "asset";
			readonly resourceId: string;
			readonly label: string;
	  }
	| {
			readonly kind: "project";
			readonly sectionId: EditorProjectSectionId;
			readonly label: string;
	  };

interface EditorGameDiagnosticPresentation {
	readonly code: EditorGameDiagnostic["code"];
	readonly severity: EditorGameDiagnostic["severity"];
	readonly title: string;
	readonly detail: string;
	readonly context?: string;
	readonly location?: string;
	readonly targets: ReadonlyArray<EditorDiagnosticTarget>;
}

const readItemIdFromPathFn = (path: ReadonlyArray<PropertyKey>) =>
	path[0] === "items" && typeof path[1] === "string" ? path[1] : undefined;

const readDiagnosticItemIdsFn = (diagnostic: EditorGameDiagnostic): ReadonlyArray<string> => {
	switch (diagnostic.code) {
		case "input:capacity-unsupported":
		case "input:material-ineligible":
		case "input:charges-invalid":
		case "merge:invalid":
		case "line:duplicate-id":
		case "line:multiple-defaults":
			return [
				diagnostic.ownerItemId,
			];
		case "deposit:stochastic-softlock":
		case "deposit:unsustainable":
			return [
				diagnostic.itemId,
			];
		case "item:duplicate-uid":
			return diagnostic.itemIds;
		case "config:key-id-mismatch":
		case "source:duplicate-record":
			return diagnostic.entity === "item"
				? [
						diagnostic.key,
					]
				: [];
		case "input:acceptance-cycle":
			return diagnostic.cycle;
		default:
			return [
				readItemIdFromPathFn(diagnostic.path),
			].filter((itemId): itemId is string => itemId !== undefined);
	}
};

const readOwnedItemSectionFn = (
	diagnostic: EditorGameDiagnostic,
): EditorItemSectionId | undefined => {
	switch (diagnostic.code) {
		case "merge:invalid":
			return "merges";
		case "input:capacity-unsupported":
		case "input:material-ineligible":
		case "input:charges-invalid":
		case "input:acceptance-cycle":
		case "line:duplicate-id":
		case "line:multiple-defaults":
		case "deposit:stochastic-softlock":
		case "deposit:unsustainable":
			return "production";
		case "resource:missing":
			return "artwork";
		default:
			return undefined;
	}
};

const readEditorGameDiagnosticTargetsFn = (
	diagnostic: EditorGameDiagnostic,
	project: Pick<EditorProject, "config" | "resources">,
): ReadonlyArray<EditorDiagnosticTarget> => {
	const itemSection =
		readOwnedItemSectionFn(diagnostic) ??
		readEditorItemSectionForPathFn(diagnostic.path.slice(2));
	const itemTargets = [
		...new Set(readDiagnosticItemIdsFn(diagnostic)),
	].flatMap((itemId) => {
		const item = project.config.items[itemId];
		return item === undefined
			? []
			: [
					{
						kind: "item",
						itemUid: item.uid,
						sectionId: itemSection,
						label: item.title,
					} satisfies EditorDiagnosticTarget,
				];
	});
	if (itemTargets.length > 0) return itemTargets;
	if (
		(diagnostic.code === "resource:duplicate" || diagnostic.code === "resource:unused") &&
		project.resources.some((resource) => resource.id === diagnostic.resourceId)
	)
		return [
			{
				kind: "asset",
				resourceId: diagnostic.resourceId,
				label: diagnostic.resourceId,
			} satisfies EditorDiagnosticTarget,
		];
	if (diagnostic.code === "source:json-invalid") return [];
	return [
		{
			kind: "project",
			sectionId: readEditorProjectSectionForPathFn(diagnostic.path),
			label: "project settings",
		} satisfies EditorDiagnosticTarget,
	];
};

const printEditorGameDiagnosticFn = (
	diagnostic: EditorGameDiagnostic,
	project: Pick<EditorProject, "config" | "resources">,
): EditorGameDiagnosticPresentation => {
	const presentation = readGameDiagnosticPresentationFn(diagnostic);
	const targets = readEditorGameDiagnosticTargetsFn(diagnostic, project);
	const location = [
		diagnostic.source,
		diagnostic.path.length === 0 ? undefined : diagnostic.path.join("."),
	]
		.filter((value) => value !== undefined)
		.join(":");

	return {
		code: diagnostic.code,
		severity: diagnostic.severity,
		...presentation,
		location: location.length === 0 ? undefined : location,
		targets,
	};
};

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
					className="rounded-xl border-l-2 p-4 data-[ui-severity=error]:border-danger data-[ui-severity=error]:bg-danger/5 data-[ui-severity=warning]:border-warning data-[ui-severity=warning]:bg-warning/5"
					{...readDataUiFn({
						dataUi: "EditorBuildDiagnostic",
						state: {
							severity: diagnostic.severity,
						},
					})}
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
