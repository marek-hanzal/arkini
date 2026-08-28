import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readRuntimeItemDefaultAssetIdsFx } from "~/engine/item/read/readRuntimeItemDefaultAssetIdsFx";
import { lineRunRuntime } from "~test/line/fx/run/support/lineRunTestRuntime";

describe("readRuntimeItemDefaultAssetIdsFx", () => {
	it("reads the complete authored default without a ceremonial runtime input", () => {
		const item = lineRunRuntime({}).items[0]?.item;
		if (item === undefined) throw new Error("Missing test item.");
		expect(
			Effect.runSync(
				readRuntimeItemDefaultAssetIdsFx({
					item,
				}),
			),
		).toEqual(item.asset.default);
	});
});
