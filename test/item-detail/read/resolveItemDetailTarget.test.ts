import { describe, expect, it } from "vitest";

import { readItemDetailTabs } from "~/engine/item-detail/read/readItemDetailTabs";
import { resolveItemDetailTarget } from "~/engine/item-detail/read/resolveItemDetailTarget";
import { lineRunRuntime, lineRunTestConfig } from "~test/line/fx/run/support/lineRunTestRuntime";

const sourceProjection = {
	kind: "available",
	itemId: "runtime:workshop",
	targetDefinitionItemId: "water",
	source: [
		{
			ownerItemId: "runtime:source",
			ownerDefinitionItemId: "workshop",
			space: 0,
			line: [],
		},
	],
} as const;

describe("resolveItemDetailTarget", () => {
	it("exposes one finite authoritative tab set and validates requested tabs", () => {
		const runtime = lineRunRuntime({});
		expect(readItemDetailTabs(runtime.items[0])).toEqual([
			"lines",
			"queue",
			"info",
		]);
		expect(readItemDetailTabs(runtime.items[0], sourceProjection)).toEqual([
			"lines",
			"queue",
			"sources",
			"info",
		]);
		expect(
			resolveItemDetailTarget({
				itemId: "runtime:workshop",
				runtime,
			}),
		).toMatchObject({
			kind: "available",
			itemId: "runtime:workshop",
			tab: "lines",
		});
		expect(
			resolveItemDetailTarget({
				itemId: "runtime:workshop",
				requestedTab: "queue",
				runtime,
			}),
		).toMatchObject({
			kind: "available",
			itemId: "runtime:workshop",
			tab: "queue",
		});
		expect(
			resolveItemDetailTarget({
				itemId: "runtime:workshop",
				requestedTab: "sources",
				runtime,
				sources: sourceProjection,
			}),
		).toMatchObject({
			kind: "available",
			itemId: "runtime:workshop",
			tab: "sources",
		});
	});

	it("keeps Info as the unsupported-tab fallback without retargeting and rejects stale identities", () => {
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
			resolveItemDetailTarget({
				itemId: "runtime:workshop",
				requestedTab: "lines",
				runtime: ordinaryRuntime,
			}),
		).toEqual({
			kind: "available",
			itemId: "runtime:workshop",
			tab: "info",
			tabs: [
				"info",
			],
		});
		expect(
			resolveItemDetailTarget({
				itemId: "runtime:missing",
				requestedTab: "info",
				runtime,
			}),
		).toEqual({
			kind: "unavailable",
		});
	});
});
