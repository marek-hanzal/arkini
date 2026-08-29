import { describe, expect, it } from "vitest";

import { printEditorGameDiagnosticFn } from "~/editor-build/ui/fn/printEditorGameDiagnosticFn";
import type { EditorProject } from "~/editor/EditorProject";

const project = {
	config: {
		items: {
			"producer:academy": {
				uid: "academy-uid",
				title: "Academy",
			},
			"producer:library": {
				uid: "library-uid",
				title: "Library",
			},
		},
	},
	resources: [
		{
			id: "unused-asset",
		},
	],
} as unknown as Pick<EditorProject, "config" | "resources">;

describe("printEditorGameDiagnostic", () => {
	it("links an item-owned input diagnostic to its production form", () => {
		const printed = printEditorGameDiagnosticFn(
			{
				code: "input:capacity-unsupported",
				severity: "error",
				path: [
					"items",
					"producer:academy",
					"lines",
					0,
					"inputs",
					0,
				],
				message: "This input buffer is only supported by producer lines.",
				ownerItemId: "producer:academy",
				lineId: "line:academy:knowledge",
				inputIndex: 0,
				capacity: 2,
			},
			project,
		);

		expect(printed.title).toBe("Unsupported input capacity");
		expect(printed.targets).toEqual([
			{
				kind: "item",
				itemUid: "academy-uid",
				sectionId: "production",
				label: "Academy",
			},
		]);
	});

	it("links an existing unused resource to its asset detail", () => {
		const printed = printEditorGameDiagnosticFn(
			{
				code: "resource:unused",
				severity: "warning",
				path: [
					"resources",
					"unused-asset",
				],
				message: "The asset is not referenced by the project.",
				resourceId: "unused-asset",
			},
			project,
		);

		expect(printed.targets).toEqual([
			{
				kind: "asset",
				resourceId: "unused-asset",
				label: "unused-asset",
			},
		]);
	});

	it("links every item involved in a duplicate UID diagnostic", () => {
		const printed = printEditorGameDiagnosticFn(
			{
				code: "item:duplicate-uid",
				severity: "error",
				path: [
					"items",
					"producer:library",
					"uid",
				],
				message: "Academy and Library share the same immutable UID.",
				uid: "duplicate-uid",
				itemIds: [
					"producer:academy",
					"producer:library",
				],
				paths: [
					[
						"items",
						"producer:academy",
						"uid",
					],
					[
						"items",
						"producer:library",
						"uid",
					],
				],
			},
			project,
		);

		expect(printed.targets.map((target) => target.label)).toEqual([
			"Academy",
			"Library",
		]);
	});
});
