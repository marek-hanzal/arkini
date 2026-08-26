import { describe, expect, it } from "vitest";

import type { EditorProjectVersionDescriptor } from "~/editor/version/EditorProjectVersion";
import { layoutEditorVersionGraph } from "~/ui/version/editor/layoutEditorVersionGraph";

const version = (
	versionId: string,
	createdAtMs: number,
	parentVersionId?: string,
): EditorProjectVersionDescriptor => ({
	arkini: "0.5.0",
	arkpackVersion: "1.0",
	createdAtMs,
	...(parentVersionId === undefined
		? {}
		: {
				parentVersionId,
			}),
	projectId: "project-one",
	sourceRevision: createdAtMs,
	subject: versionId,
	versionId,
});

describe("layoutEditorVersionGraph", () => {
	it("keeps the checked-out base lane stable while sibling descendants merge into it", () => {
		const root = version("root", 1);
		const first = version("first", 2, root.versionId);
		const second = version("second", 3, root.versionId);

		expect(
			layoutEditorVersionGraph(
				[
					root,
					first,
					second,
				],
				root.versionId,
			),
		).toEqual({
			laneCount: 2,
			workingCopyLane: 0,
			rows: [
				{
					activeLanes: [
						0,
						1,
					],
					lane: 1,
					parentLane: 0,
					version: second,
				},
				{
					activeLanes: [
						0,
						1,
					],
					lane: 1,
					parentLane: 0,
					version: first,
				},
				{
					activeLanes: [
						0,
					],
					lane: 0,
					version: root,
				},
			],
		});
	});
});
