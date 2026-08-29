import type { EditorGameDiagnostic } from "~/editor/build/fn/readEditorBuildFailureFn";
import type { EditorProject } from "~/editor/EditorProject";
import type { EditorDiagnosticTarget } from "~/ui/arkpack/editor/EditorDiagnosticTarget";
import type { EditorItemSectionId } from "~/item-authoring/ui/EditorItemSections";
import { readEditorItemSectionForPathFn } from "~/item-authoring/ui/fn/readEditorItemSectionForPathFn";
import { readEditorProjectSectionForPathFn } from "~/ui/project/editor/fn/readEditorProjectSectionForPathFn";

const readItemIdFromPath = (path: ReadonlyArray<PropertyKey>) =>
	path[0] === "items" && typeof path[1] === "string" ? path[1] : undefined;

const readDiagnosticItemIds = (diagnostic: EditorGameDiagnostic): ReadonlyArray<string> => {
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
				readItemIdFromPath(diagnostic.path),
			].filter((itemId): itemId is string => itemId !== undefined);
	}
};

const readOwnedItemSection = (
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

/** Resolves one diagnostic into canonical editor navigation targets. */
export const readEditorGameDiagnosticTargetsFn = (
	diagnostic: EditorGameDiagnostic,
	project: Pick<EditorProject, "config" | "resources">,
): ReadonlyArray<EditorDiagnosticTarget> => {
	const itemSection =
		readOwnedItemSection(diagnostic) ??
		readEditorItemSectionForPathFn(diagnostic.path.slice(2));
	const itemTargets = [
		...new Set(readDiagnosticItemIds(diagnostic)),
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
