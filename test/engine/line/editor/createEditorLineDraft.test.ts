import { describe, expect, it } from "vitest";

import { createEditorLineDraft } from "~/engine/line/editor/createEditorLineDraft";

describe("createEditorLineDraft", () => {
	it("creates the first line as the sole authored default", () => {
		const line = createEditorLineDraft({
			existingLines: [],
			itemId: "producer:lumberjack",
			type: "producer",
		});

		expect(line.id).toBe("line:lumberjack:default");
		expect(line.default).toBe(true);
	});

	it("creates later lines with unique IDs without adding another default", () => {
		const first = createEditorLineDraft({
			existingLines: [],
			itemId: "producer:lumberjack",
			type: "producer",
		});
		const second = createEditorLineDraft({
			existingLines: [
				first,
			],
			itemId: "producer:lumberjack",
			type: "producer",
		});
		const third = createEditorLineDraft({
			existingLines: [
				first,
				second,
			],
			itemId: "producer:lumberjack",
			type: "producer",
		});

		expect(second.id).toBe("line:lumberjack:2");
		expect(second.default).toBe(false);
		expect(third.id).toBe("line:lumberjack:3");
		expect(third.default).toBe(false);
	});

	it("skips IDs already authored by the user", () => {
		const first = createEditorLineDraft({
			existingLines: [],
			itemId: "item:ore",
			type: "deposit",
		});
		const manuallyNamed = {
			...first,
			id: "line:ore:2",
			default: false,
		};
		const next = createEditorLineDraft({
			existingLines: [
				first,
				manuallyNamed,
			],
			itemId: "item:ore",
			type: "deposit",
		});

		expect(next.id).toBe("line:ore:3");
		expect(next.default).toBe(false);
	});
});
