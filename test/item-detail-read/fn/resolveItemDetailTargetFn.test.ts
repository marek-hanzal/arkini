import { describe, expect, it } from "vitest";

import { resolveItemDetailTargetFn } from "~/item-detail-read/fn/resolveItemDetailTargetFn";
import {
	lineRunRuntime,
	lineRunTestConfig,
} from "~test/production-line/support/lineRunTestRuntime";

describe("resolveItemDetailTargetFn", () => {
	it("resolves existing items without production and rejects missing targets", () => {
		const runtime = lineRunRuntime({});
		const ordinaryRuntime = {
			...runtime,
			items: [
				{
					...runtime.items[0],
					item: lineRunTestConfig.items.water,
				},
			],
		};
		expect(
			resolveItemDetailTargetFn({
				itemId: "runtime:workshop",
				runtime: ordinaryRuntime,
			}),
		).toEqual({
			kind: "available",
			itemId: "runtime:workshop",
		});
		expect(
			resolveItemDetailTargetFn({
				itemId: "runtime:missing",
				runtime,
			}),
		).toEqual({
			kind: "unavailable",
		});
	});
});
