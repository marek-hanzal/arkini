import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { EditorOriginFlowVisitHistoryLimit } from "~/ui/item/editor/EditorOriginFlowVisitHistory";
import { popEditorOriginFlowVisitFx } from "~/ui/item/editor/popEditorOriginFlowVisitFx";
import { pushEditorOriginFlowVisitFx } from "~/ui/item/editor/pushEditorOriginFlowVisitFx";

describe("editor origin flow visit history", () => {
	it("keeps repeated visits while deduplicating only the current head", () => {
		let history: ReadonlyArray<string> = [];
		history = Effect.runSync(pushEditorOriginFlowVisitFx(history, "item:a"));
		history = Effect.runSync(pushEditorOriginFlowVisitFx(history, "item:a"));
		history = Effect.runSync(pushEditorOriginFlowVisitFx(history, "item:b"));
		history = Effect.runSync(pushEditorOriginFlowVisitFx(history, "item:a"));

		expect(history).toEqual([
			"item:a",
			"item:b",
			"item:a",
		]);
	});

	it("walks backward by removing the current visit", () => {
		const first = Effect.runSync(
			popEditorOriginFlowVisitFx([
				"item:a",
				"item:b",
				"item:c",
			]),
		);
		expect(first).toEqual({
			history: [
				"item:a",
				"item:b",
			],
			nodeId: "item:b",
		});
		expect(Effect.runSync(popEditorOriginFlowVisitFx(first.history))).toEqual({
			history: [
				"item:a",
			],
			nodeId: "item:a",
		});
	});

	it("keeps only the most recent bounded visits", () => {
		let history: ReadonlyArray<string> = [];
		for (let index = 0; index < EditorOriginFlowVisitHistoryLimit + 4; index += 1)
			history = Effect.runSync(pushEditorOriginFlowVisitFx(history, `item:${index}`));

		expect(history).toHaveLength(EditorOriginFlowVisitHistoryLimit);
		expect(history[0]).toBe("item:4");
		expect(history.at(-1)).toBe(`item:${EditorOriginFlowVisitHistoryLimit + 3}`);
	});
});
