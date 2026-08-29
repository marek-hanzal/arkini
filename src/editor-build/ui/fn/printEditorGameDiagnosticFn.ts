import type { EditorProject } from "~/project-authoring/EditorProject";
import { readGameDiagnosticPresentationFn } from "~/game-config/diagnostic/printer/fn/readGameDiagnosticPresentationFn";
import type { GameDiagnosticSchema } from "~/game-config/diagnostic/schema/GameDiagnosticSchema";
import type { EditorItemSectionId } from "~/item-authoring/ui/EditorItemSections";
import { readEditorItemSectionForPathFn } from "~/item-authoring/ui/fn/readEditorItemSectionForPathFn";
import type { EditorProjectSectionId } from "~/project-authoring/configuration/EditorProjectSections";
import { readEditorProjectSectionForPathFn } from "~/project-authoring/configuration/fn/readEditorProjectSectionForPathFn";

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

/** Projects one canonical diagnostic into editor copy and actionable route targets. */
export const printEditorGameDiagnosticFn = (
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
