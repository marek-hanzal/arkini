import { describe, expect, it } from "vitest";

import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import {
	parseEditorItemSectionId,
	readEditorItemSectionForPath,
	readEditorItemSections,
} from "~/ui/item/editor/EditorItemSections";

const item = (type: EditorItem["type"]) =>
	({
		type,
	}) as Pick<EditorItem, "type">;

describe("EditorItemSections", () => {
	it("parses only supported dynamic route sections", () => {
		expect(parseEditorItemSectionId("artwork")).toBe("artwork");
		expect(() => parseEditorItemSectionId("unknown")).toThrow(
			"Unknown editor item section unknown.",
		);
	});

	it("keeps the canonical shared sections and adds only type-owned concerns", () => {
		expect(readEditorItemSections(item("simple")).map(({ id }) => id)).toEqual([
			"identity",
			"artwork",
			"limits",
			"charges",
			"merges",
		]);
		expect(readEditorItemSections(item("inventory")).map(({ id }) => id)).toEqual([
			"identity",
			"artwork",
			"charges",
			"merges",
		]);
		expect(readEditorItemSections(item("producer")).map(({ id }) => id)).toEqual([
			"identity",
			"artwork",
			"limits",
			"charges",
			"merges",
			"production",
		]);
	});

	it("routes schema issues to the section that owns their top-level field", () => {
		expect(
			readEditorItemSectionForPath([
				"title",
			]),
		).toBe("identity");
		expect(
			readEditorItemSectionForPath([
				"asset",
				"default",
				0,
			]),
		).toBe("artwork");
		expect(
			readEditorItemSectionForPath([
				"maxStackSize",
			]),
		).toBe("limits");
		expect(
			readEditorItemSectionForPath([
				"charges",
				"amount",
			]),
		).toBe("charges");
		expect(
			readEditorItemSectionForPath([
				"merge",
				0,
			]),
		).toBe("merges");
		expect(
			readEditorItemSectionForPath([
				"lines",
				1,
				"output",
			]),
		).toBe("production");
	});
});
