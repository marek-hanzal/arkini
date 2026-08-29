import { Option } from "effect";
import { describe, expect, it } from "vitest";

import { isBoardRuntimeItemFn } from "~/engine/runtime/read/fn/isBoardRuntimeItemFn";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import { isInputRuntimeItemFn } from "~/engine/runtime/read/fn/isInputRuntimeItemFn";
import { isJobRuntimeItemFn } from "~/engine/runtime/read/fn/isJobRuntimeItemFn";
import { isReservedRuntimeItemFn } from "~/engine/runtime/read/fn/isReservedRuntimeItemFn";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { inputTestItems } from "~test/input/fx/support/inputTestItems";

describe("runtime item refinement Fn", () => {
	it("preserves the exact live item while refining every runtime location family", () => {
		const board = {
			id: "item:board",
			item: inputTestItems.water,
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 1,
			revision: "revision:board",
		} satisfies RuntimeItemSchema.Type;
		const inventory = {
			id: "item:inventory",
			item: inputTestItems.water,
			location: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 1,
			revision: "revision:inventory",
		} satisfies RuntimeItemSchema.Type;
		const input = {
			id: "item:input",
			item: inputTestItems.water,
			location: {
				scope: "input",
				ownerItemId: board.id,
				lineId: "line:test",
				inputIndex: 0,
			},
			quantity: 1,
			revision: "revision:input",
		} satisfies RuntimeItemSchema.Type;
		const job = {
			id: "item:job",
			item: inputTestItems.water,
			location: {
				scope: "job",
				jobId: "job:test",
			},
			quantity: 1,
			revision: "revision:job",
		} satisfies RuntimeItemSchema.Type;
		const reserved = {
			id: "item:reserved",
			item: inputTestItems.water,
			location: {
				scope: "reserved",
				jobId: "job:test",
			},
			quantity: 1,
			revision: "revision:reserved",
		} satisfies RuntimeItemSchema.Type;

		expect(Option.getOrThrow(isBoardRuntimeItemFn(board))).toBe(board);
		expect(Option.getOrThrow(isGridRuntimeItemFn(inventory))).toBe(inventory);
		expect(Option.getOrThrow(isInputRuntimeItemFn(input))).toBe(input);
		expect(Option.getOrThrow(isJobRuntimeItemFn(job))).toBe(job);
		expect(Option.getOrThrow(isReservedRuntimeItemFn(reserved))).toBe(reserved);
		expect(Option.isNone(isGridRuntimeItemFn(job))).toBe(true);
	});
});
