import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { EditorProjectSections } from "~/ui/project/editor/EditorProjectSections";
import { parseEditorProjectSectionIdFx } from "~/ui/project/editor/parseEditorProjectSectionIdFx";
import { readEditorProjectSectionForPathFx } from "~/ui/project/editor/readEditorProjectSectionForPathFx";

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
		expect(Effect.runSync(parseEditorProjectSectionIdFx("surfaces"))).toBe("surfaces");
		expect(() => Effect.runSync(parseEditorProjectSectionIdFx("board"))).toThrow(
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
				Effect.runSync(
					readEditorProjectSectionForPathFx([
						path,
					]),
				),
			).toBe("surfaces");
		}
	});
});
