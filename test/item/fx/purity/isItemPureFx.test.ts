import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { purityTestConfig } from "~test/line/support/purityTestConfig";

const location = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

const producer = {
	id: "runtime:producer",
	item: purityTestConfig.items.producer,
	location,
	quantity: 1,
	revision: "revision:producer",
};

const simple = {
	id: "runtime:material",
	item: purityTestConfig.items.material,
	location,
	quantity: 1,
	revision: "revision:material",
};

describe("isItemPureFx", () => {
	it("accepts items that own no line or item state", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				producer,
			],
			jobs: [],
		} satisfies RuntimeSchema.Type;

		expect(
			Effect.runSync(
				isItemPureFx({
					item: producer,
					runtime,
				}),
			),
		).toBe(true);
		expect(
			Effect.runSync(
				isItemPureFx({
					item: simple,
					runtime: {
						cheats: {
							enabled: false,
							everEnabled: false,
							instantGameplay: false,
						},
						currentSpace: 0,
						items: [
							simple,
						],
						jobs: [],
					},
				}),
			),
		).toBe(true);
	});

	it("rejects an item when any owned line has buffered input", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				producer,
				{
					...simple,
					location: {
						scope: "input" as const,
						ownerItemId: producer.id,
						lineId: "line:producer:zero",
						inputIndex: 0,
					},
				},
			],
			jobs: [],
		} satisfies RuntimeSchema.Type;

		expect(
			Effect.runSync(
				isItemPureFx({
					item: producer,
					runtime,
				}),
			),
		).toBe(false);
	});

	it("rejects an item when any owned line has an active or queued run", () => {
		const activeRuntime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				producer,
			],
			jobs: [
				{
					id: "job:active",
					ownerItemId: producer.id,
					lineId: "line:producer:zero",
					durationMs: 1_000,
					remainingMs: 1_000,
				},
			],
		} satisfies RuntimeSchema.Type;
		const queuedRuntime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				producer,
			],
			jobs: [],
			jobQueue: [
				{
					id: "request:queued",
					ownerItemId: producer.id,
					lineId: "line:producer:zero",
				},
			],
		} satisfies RuntimeSchema.Type;

		expect(
			Effect.runSync(
				isItemPureFx({
					item: producer,
					runtime: activeRuntime,
				}),
			),
		).toBe(false);
		expect(
			Effect.runSync(
				isItemPureFx({
					item: producer,
					runtime: queuedRuntime,
				}),
			),
		).toBe(false);
	});
});
