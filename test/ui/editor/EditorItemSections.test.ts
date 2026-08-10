import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { parseEditorItemSectionIdFx } from "~/page/editor/parseEditorItemSectionIdFx";
import { readEditorItemSectionForPathFx } from "~/ui/item/editor/readEditorItemSectionForPathFx";
import { readEditorItemSectionsFx } from "~/ui/item/editor/readEditorItemSectionsFx";

const item = (type: EditorItem["type"]) =>
	({
		type,
	}) as Pick<EditorItem, "type">;

describe("EditorItemSections", () => {
	it("parses only supported dynamic route sections", () => {
		expect(Effect.runSync(parseEditorItemSectionIdFx("artwork"))).toBe("artwork");
		expect(() => Effect.runSync(parseEditorItemSectionIdFx("unknown"))).toThrow(
			"Unknown editor item section unknown.",
		);
	});

	it("keeps the canonical shared sections and adds only type-owned concerns", () => {
		expect(Effect.runSync(readEditorItemSectionsFx(item("simple")))[0]).toEqual({
			id: "identity",
			label: "Item",
		});
		expect(
			Effect.runSync(readEditorItemSectionsFx(item("simple"))).map(({ id }) => id),
		).toEqual([
			"identity",
			"artwork",
			"charges",
			"merges",
			"flow",
		]);
		expect(
			Effect.runSync(readEditorItemSectionsFx(item("inventory"))).map(({ id }) => id),
		).toEqual([
			"identity",
			"artwork",
			"charges",
			"merges",
			"flow",
		]);
		expect(
			Effect.runSync(readEditorItemSectionsFx(item("producer"))).map(({ id }) => id),
		).toEqual([
			"identity",
			"artwork",
			"charges",
			"merges",
			"production",
			"flow",
		]);
	});

	it("routes schema issues to the section that owns their top-level field", () => {
		expect(
			Effect.runSync(
				readEditorItemSectionForPathFx([
					"title",
				]),
			),
		).toBe("identity");
		expect(
			Effect.runSync(
				readEditorItemSectionForPathFx([
					"asset",
					"default",
					0,
				]),
			),
		).toBe("artwork");
		expect(
			Effect.runSync(
				readEditorItemSectionForPathFx([
					"maxStackSize",
				]),
			),
		).toBe("identity");
		expect(
			Effect.runSync(
				readEditorItemSectionForPathFx([
					"charges",
					"amount",
				]),
			),
		).toBe("charges");
		expect(
			Effect.runSync(
				readEditorItemSectionForPathFx([
					"merge",
					0,
				]),
			),
		).toBe("merges");
		expect(
			Effect.runSync(
				readEditorItemSectionForPathFx([
					"lines",
					1,
					"output",
				]),
			),
		).toBe("production");
	});
});
