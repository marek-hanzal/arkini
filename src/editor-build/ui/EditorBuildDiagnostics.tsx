import { match } from "ts-pattern";
import { Tx } from "~/translation/ui/Tx";
import type { Project } from "~/project-authoring/type/Project";
import { readGameDiagnosticPresentationFn } from "~/game-config-diagnostic/fn/readGameDiagnosticPresentationFn";
import type { GameDiagnosticSchema } from "~/game-config-diagnostic/schema/GameDiagnosticSchema";
import type { SectionId } from "~/item-authoring/type/Section";
import { readSectionForPathFn } from "~/item-authoring/fn/readSectionForPathFn";
import type { ProjectSectionId } from "~/project-authoring/type/ProjectSections";
import { readProjectSectionForPathFn } from "~/project-authoring/fn/readProjectSectionForPathFn";
import { ButtonLink } from "~/ui/ui/Button";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

type EditorDiagnosticTarget =
	| {
			readonly kind: "item";
			readonly itemUid: string;
			readonly sectionId: SectionId;
			readonly label: string;
	  }
	| {
			readonly kind: "resource";
			readonly resourceUid: string;
			readonly resourceType: Project.Resource["type"];
			readonly label: string;
	  }
	| {
			readonly kind: "project";
			readonly sectionId: ProjectSectionId;
	  };

interface EditorGameDiagnosticPresentation {
	readonly code: GameDiagnosticSchema.Type["code"];
	readonly severity: GameDiagnosticSchema.Type["severity"];
	readonly title: string;
	readonly detail: string;
	readonly context?: string;
	readonly location?: string;
	readonly targets: ReadonlyArray<EditorDiagnosticTarget>;
}

const readItemUidFromPathFn = (path: ReadonlyArray<PropertyKey>) =>
	path[0] === "items" && typeof path[1] === "string" ? path[1] : undefined;

const readDiagnosticItemUidsFn = (diagnostic: GameDiagnosticSchema.Type): ReadonlyArray<string> => {
	return match(diagnostic)
		.with(
			{
				code: "input:units-invalid",
			},
			{
				code: "merge:invalid",
			},
			{
				code: "line:duplicate-uid",
			},
			{
				code: "line:multiple-selections",
			},
			(diagnostic) => {
				return [
					diagnostic.ownerItemUid,
				];
			},
		)
		.with(
			{
				code: "units:stochastic-renewal",
			},
			{
				code: "units:missing-renewal",
			},
			(diagnostic) => {
				return [
					diagnostic.itemUid,
				];
			},
		)
		.with(
			{
				code: "config:key-uid-mismatch",
			},
			{
				code: "source:duplicate-record",
			},
			(diagnostic) => {
				return diagnostic.entity === "item"
					? [
							diagnostic.key,
						]
					: [];
			},
		)
		.with(
			{
				code: "input:acceptance-cycle",
			},
			(diagnostic) => {
				return diagnostic.cycle;
			},
		)
		.otherwise((diagnostic) => {
			return [
				readItemUidFromPathFn(diagnostic.path),
			].filter((itemUid): itemUid is string => itemUid !== undefined);
		});
};

const readOwnedItemSectionFn = (diagnostic: GameDiagnosticSchema.Type): SectionId | undefined => {
	return match(diagnostic.code)
		.returnType<SectionId | undefined>()
		.with("merge:invalid", () => {
			return "merges";
		})
		.with(
			"input:units-invalid",
			"input:acceptance-cycle",
			"line:duplicate-uid",
			"line:multiple-selections",
			() => {
				return "production";
			},
		)
		.with("units:stochastic-renewal", "units:missing-renewal", () => {
			return "units";
		})
		.with("resource:missing", () => {
			return "artwork";
		})
		.otherwise(() => {
			return undefined;
		});
};

const readEditorGameDiagnosticTargetsFn = (
	diagnostic: GameDiagnosticSchema.Type,
	project: Pick<Project, "config" | "resources">,
): ReadonlyArray<EditorDiagnosticTarget> => {
	const itemSection = readOwnedItemSectionFn(diagnostic);
	const itemTargets = [
		...new Set(readDiagnosticItemUidsFn(diagnostic)),
	].flatMap((itemUid) => {
		const item = project.config.items[itemUid];
		const pathSection =
			item === undefined
				? undefined
				: readSectionForPathFn(diagnostic.path.slice(2), item.lines);
		return item === undefined
			? []
			: [
					{
						kind: "item",
						itemUid: item.uid,
						sectionId:
							pathSection === "clock"
								? "clock"
								: (itemSection ?? pathSection ?? "identity"),
						label: item.title,
					} satisfies EditorDiagnosticTarget,
				];
	});
	if (itemTargets.length > 0) return itemTargets;
	const resource =
		(diagnostic.code === "resource:duplicate" || diagnostic.code === "resource:unused") &&
		project.resources.find((candidate) => candidate.uid === diagnostic.resourceUid);
	if (resource)
		return [
			{
				kind: "resource",
				resourceUid: diagnostic.resourceUid,
				resourceType: resource.type,
				label: diagnostic.resourceUid,
			} satisfies EditorDiagnosticTarget,
		];
	if (diagnostic.code === "source:json-invalid") return [];
	return [
		{
			kind: "project",
			sectionId: readProjectSectionForPathFn(diagnostic.path),
		} satisfies EditorDiagnosticTarget,
	];
};

const printEditorGameDiagnosticFn = (
	diagnostic: GameDiagnosticSchema.Type,
	project: Pick<Project, "config" | "resources">,
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
	return match(target)
		.with(
			{
				kind: "item",
			},
			(target) => {
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
						<Tx label="Open" /> {target.label}
					</ButtonLink>
				);
			},
		)
		.with(
			{
				kind: "resource",
			},
			(target) => {
				return target.resourceType === "artwork" ? (
					<ButtonLink
						className="mt-3 w-fit shadow-none"
						to="/editor/$projectId/artwork/$resourceUid/detail/overview"
						params={{
							projectId,
							resourceUid: target.resourceUid,
						}}
					>
						<Tx label="Open artwork" /> {target.label}
					</ButtonLink>
				) : (
					<ButtonLink
						className="mt-3 w-fit shadow-none"
						to="/editor/$projectId/project/detail/$sectionId"
						params={{
							projectId,
							sectionId: "images",
						}}
					>
						<Tx label="Open project images" />
					</ButtonLink>
				);
			},
		)
		.with(
			{
				kind: "project",
			},
			(target) => {
				return (
					<ButtonLink
						className="mt-3 w-fit shadow-none"
						to="/editor/$projectId/project/form/$sectionId"
						params={{
							projectId,
							sectionId: target.sectionId,
						}}
					>
						<Tx label="Open project settings" />
					</ButtonLink>
				);
			},
		)
		.exhaustive();
};

/** Renders structured build diagnostics without discarding their actionable editor context. */
export const EditorBuildDiagnostics = ({
	diagnostics,
	project,
}: {
	readonly diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>;
	readonly project: Pick<Project, "projectId" | "config" | "resources">;
}) => (
	<ul className="grid gap-3">
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
									key={
										target.kind === "project"
											? `project-${target.sectionId}`
											: `${target.kind}-${target.label}`
									}
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
