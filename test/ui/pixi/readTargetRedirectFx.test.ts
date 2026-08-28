import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { runTileDropAtom } from "~/ui/pixi/command/runTileDropAtom";
import { readTargetRedirectFx } from "~/ui/pixi/motion/readTargetRedirectFx";

const sourceLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 0,
	},
};
const targetLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 2,
		y: 0,
	},
};

const storedSource = {
	canonicalItemId: "log",
	current: null,
	itemId: "runtime:log",
	previousLocation: sourceLocation,
	previousQuantity: 1,
	previousRevision: "revision:log:1",
} as const;

describe("readTargetRedirectFx target ownership", () => {
	it("hands a consumed input source to its physical line owner", () => {
		const result = {
			inputIndex: 0,
			kind: "store-input",
			lineId: "line:log",
			owner: {
				itemId: "runtime:lumberjack",
				location: targetLocation,
				revision: "revision:lumberjack:2",
			},
			source: storedSource,
			storedQuantity: 1,
		} satisfies runTileDropAtom.Result;

		expect(Effect.runSync(readTargetRedirectFx(result))).toEqual({
			sourceActorId: storedSource.itemId,
			targetActorId: result.owner.itemId,
			targetLocation: result.owner.location,
		});
	});

	it("hands a consumed merge source to the surviving target identity", () => {
		const result = {
			action: "consume",
			effect: "replace",
			kind: "merge",
			resultCanonicalItemId: "double-tree",
			source: {
				itemId: storedSource.itemId,
				current: null,
				previousLocation: sourceLocation,
				previousQuantity: 1,
				previousRevision: storedSource.previousRevision,
			},
			target: {
				current: {
					canonicalItemId: "double-tree",
					itemId: "runtime:tree",
					location: targetLocation,
					quantity: 1,
					revision: "revision:tree:2",
				},
				itemId: "runtime:tree",
				previousLocation: targetLocation,
				previousQuantity: 1,
				previousRevision: "revision:tree:1",
			},
		} satisfies runTileDropAtom.Result;

		expect(Effect.runSync(readTargetRedirectFx(result))).toEqual({
			sourceActorId: storedSource.itemId,
			targetActorId: result.target.current.itemId,
			targetLocation: result.target.current.location,
		});
	});

	it("keeps following the original runtime identity while a source remainder survives", () => {
		const result = {
			inputIndex: 0,
			kind: "store-input",
			lineId: "line:log",
			owner: {
				itemId: "runtime:lumberjack",
				location: targetLocation,
				revision: "revision:lumberjack:2",
			},
			source: {
				...storedSource,
				current: {
					canonicalItemId: "log",
					itemId: storedSource.itemId,
					location: sourceLocation,
					quantity: 2,
					revision: "revision:log:2",
				},
				previousQuantity: 3,
			},
			storedQuantity: 1,
		} satisfies runTileDropAtom.Result;

		expect(Effect.runSync(readTargetRedirectFx(result))).toBeNull();
	});
});
