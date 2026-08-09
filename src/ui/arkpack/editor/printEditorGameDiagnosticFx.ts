import { Effect } from "effect";

import type { EditorGameDiagnostic } from "~/bridge/arkpack/editor/readEditorBuildDiagnosticsFx";
import { readEditorGameDiagnosticPresentationFx } from "~/bridge/arkpack/editor/readEditorGameDiagnosticPresentationFx";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { readEditorItemSectionForPathFx } from "~/ui/item/editor/readEditorItemSectionForPathFx";
import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";
import { readEditorProjectSectionForPathFx } from "~/ui/project/editor/readEditorProjectSectionForPathFx";

export type EditorDiagnosticTarget =
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

export interface EditorGameDiagnosticPresentation {
	readonly code: EditorGameDiagnostic["code"];
	readonly severity: EditorGameDiagnostic["severity"];
	readonly title: string;
	readonly detail: string;
	readonly context?: string;
	readonly location?: string;
	readonly targets: ReadonlyArray<EditorDiagnosticTarget>;
}

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

/** Projects one canonical diagnostic into editor copy and actionable route targets. */
export const printEditorGameDiagnosticFx = Effect.fn("printEditorGameDiagnosticFx")(function* (
	diagnostic: EditorGameDiagnostic,
	project: Pick<EditorProject, "config" | "resources">,
) {
	const presentation = yield* readEditorGameDiagnosticPresentationFx(diagnostic);
	const ownedItemSection = readOwnedItemSection(diagnostic);
	const itemSection =
		ownedItemSection ?? (yield* readEditorItemSectionForPathFx(diagnostic.path.slice(2)));
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
	let targets: ReadonlyArray<EditorDiagnosticTarget>;
	if (itemTargets.length > 0) {
		targets = itemTargets;
	} else if (
		(diagnostic.code === "resource:duplicate" || diagnostic.code === "resource:unused") &&
		project.resources.some((resource) => resource.id === diagnostic.resourceId)
	) {
		targets = [
			{
				kind: "asset",
				resourceId: diagnostic.resourceId,
				label: diagnostic.resourceId,
			},
		];
	} else if (diagnostic.code === "source:json-invalid") {
		targets = [];
	} else {
		targets = [
			{
				kind: "project",
				sectionId: yield* readEditorProjectSectionForPathFx(diagnostic.path),
				label: "project settings",
			},
		];
	}
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
	} satisfies EditorGameDiagnosticPresentation;
});
