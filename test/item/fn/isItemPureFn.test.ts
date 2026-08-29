import { describe, expect, it } from "vitest";

import { isItemPureFn } from "~/engine/item/fn/isItemPureFn";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { purityTestConfig } from "~test/production-line/support/purityTestConfig";

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

describe("isItemPureFn", () => {
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

			jobQueue: [],
			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		expect(
			isItemPureFn({
				item: producer,
				runtime,
			}),
		).toBe(true);
		expect(
			isItemPureFn({
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

					jobQueue: [],
					defaultLineByOwnerItemId: {},
				},
			}),
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

			jobQueue: [],
			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		expect(
			isItemPureFn({
				item: producer,
				runtime,
			}),
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

			jobQueue: [],
			defaultLineByOwnerItemId: {},
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

			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		expect(
			isItemPureFn({
				item: producer,
				runtime: activeRuntime,
			}),
		).toBe(false);
		expect(
			isItemPureFn({
				item: producer,
				runtime: queuedRuntime,
			}),
		).toBe(false);
	});
});
