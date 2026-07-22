import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readRuntimeItemPrimaryAssetIdFx } from "~/engine/item/read/readRuntimeItemPrimaryAssetIdFx";
import { lineRunRuntime } from "~test/line/fx/run/support/lineRunTestRuntime";

describe("readRuntimeItemPrimaryAssetIdFx", () => {
	it("reads the first authored source without a ceremonial runtime input", () => {
		const item = lineRunRuntime({}).items[0]?.item;
		if (item === undefined) throw new Error("Missing test item.");
		expect(
			Effect.runSync(
				readRuntimeItemPrimaryAssetIdFx({
					item,
				}),
			),
		).toBe(item.asset.source[0]);
	});
});
