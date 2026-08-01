import { describe, expect, it } from "vitest";

import {
	EditorProjectSections,
	parseEditorProjectSectionId,
	readEditorProjectSectionForPath,
} from "~/ui/project/editor/EditorProjectSections";

describe("EditorProjectSections", () => {
	it("keeps metadata, appearance, and all game surfaces as three route leaves", () => {
		expect(EditorProjectSections).toEqual([
			{
				id: "general",
				label: "General",
			},
			{
				id: "appearance",
				label: "Appearance",
			},
			{
				id: "surfaces",
				label: "Surfaces",
			},
		]);
		expect(parseEditorProjectSectionId("surfaces")).toBe("surfaces");
		expect(() => parseEditorProjectSectionId("board")).toThrow(
			"Unknown editor project section board.",
		);
	});

	it("routes every surface validation error to the combined section", () => {
		for (const path of [
			"board",
			"toolbarSize",
			"inventory",
		]) {
			expect(
				readEditorProjectSectionForPath([
					path,
				]),
			).toBe("surfaces");
		}
	});
});
