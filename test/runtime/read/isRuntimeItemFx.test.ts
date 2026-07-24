import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { isInputRuntimeItemFx } from "~/engine/runtime/read/isInputRuntimeItemFx";
import { isJobRuntimeItemFx } from "~/engine/runtime/read/isJobRuntimeItemFx";
import { isReservedRuntimeItemFx } from "~/engine/runtime/read/isReservedRuntimeItemFx";
import { createRuntimeItemFx } from "~/engine/runtime/fx/createRuntimeItemFx";
import { inputTestItems } from "~test/input/fx/support/inputTestItems";

describe("runtime item refinement Fx", () => {
	it("preserves the exact live item while refining every runtime location family", () => {
		const board = Effect.runSync(
			createRuntimeItemFx({
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
			}),
		);
		const inventory = Effect.runSync(
			createRuntimeItemFx({
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
			}),
		);
		const input = Effect.runSync(
			createRuntimeItemFx({
				id: "item:input",
				item: inputTestItems.water,
				location: {
					scope: "input",
					ownerItemId: board.id,
					lineId: "line:test",
					inputIndex: 0,
				},
				quantity: 1,
			}),
		);
		const job = Effect.runSync(
			createRuntimeItemFx({
				id: "item:job",
				item: inputTestItems.water,
				location: {
					scope: "job",
					jobId: "job:test",
				},
				quantity: 1,
			}),
		);
		const reserved = Effect.runSync(
			createRuntimeItemFx({
				id: "item:reserved",
				item: inputTestItems.water,
				location: {
					scope: "reserved",
					jobId: "job:test",
				},
				quantity: 1,
			}),
		);

		expect(Option.getOrThrow(Effect.runSync(isBoardRuntimeItemFx(board)))).toBe(board);
		expect(Option.getOrThrow(Effect.runSync(isGridRuntimeItemFx(inventory)))).toBe(inventory);
		expect(Option.getOrThrow(Effect.runSync(isInputRuntimeItemFx(input)))).toBe(input);
		expect(Option.getOrThrow(Effect.runSync(isJobRuntimeItemFx(job)))).toBe(job);
		expect(Option.getOrThrow(Effect.runSync(isReservedRuntimeItemFx(reserved)))).toBe(reserved);
		expect(Option.isNone(Effect.runSync(isGridRuntimeItemFx(job)))).toBe(true);
	});
});
