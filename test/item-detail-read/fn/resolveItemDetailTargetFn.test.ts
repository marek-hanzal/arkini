import { describe, expect, it } from "vitest";

import { resolveItemDetailTargetFn } from "~/item-detail-read/fn/resolveItemDetailTargetFn";
import {
	lineRunRuntime,
	lineRunTestConfig,
} from "~test/production-line/support/lineRunTestRuntime";

describe("resolveItemDetailTargetFn", () => {
	it("defaults line owners to Lines and keeps every requested detail section available", () => {
		const runtime = lineRunRuntime({});
		expect(
			resolveItemDetailTargetFn({
				itemId: "runtime:workshop",
				runtime,
			}),
		).toEqual({
			kind: "available",
			itemId: "runtime:workshop",
			tab: "lines",
		});
		for (const requestedTab of [
			"lines",
			"queue",
			"info",
		] as const) {
			expect(
				resolveItemDetailTargetFn({
					itemId: "runtime:workshop",
					requestedTab,
					runtime,
				}),
			).toMatchObject({
				tab: requestedTab,
			});
		}
	});

	it("defaults ordinary runtime items to Info and rejects missing targets", () => {
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
			tab: "info",
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
