import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { EditorProjectSections } from "~/ui/project/editor/EditorProjectSections";
import { parseEditorProjectSectionIdFx } from "~/page/editor/parseEditorProjectSectionIdFx";
import { readEditorProjectSectionForPathFx } from "~/ui/project/editor/readEditorProjectSectionForPathFx";

describe("EditorProjectSections", () => {
	it("keeps metadata, appearance, and each game surface as explicit route leaves", () => {
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
				id: "board",
				label: "Board",
			},
			{
				id: "toolbar",
				label: "Toolbar",
			},
			{
				id: "inventory",
				label: "Inventory",
			},
		]);
		for (const section of [
			"board",
			"toolbar",
			"inventory",
		] as const) {
			expect(Effect.runSync(parseEditorProjectSectionIdFx(section))).toBe(section);
		}
		expect(() => Effect.runSync(parseEditorProjectSectionIdFx("surfaces"))).toThrow(
			"Unknown editor project section surfaces.",
		);
	});

	it("routes size and initial-state validation errors to their owning surface", () => {
		for (const [path, expected] of [
			[
				[
					"board",
				],
				"board",
			],
			[
				[
					"toolbarSize",
				],
				"toolbar",
			],
			[
				[
					"inventory",
				],
				"inventory",
			],
			[
				[
					"start",
					"board",
					0,
				],
				"board",
			],
			[
				[
					"start",
					"toolbar",
					0,
				],
				"toolbar",
			],
			[
				[
					"start",
					"inventory",
					0,
				],
				"inventory",
			],
		] as const) {
			expect(Effect.runSync(readEditorProjectSectionForPathFx(path))).toBe(expected);
		}
	});
});
