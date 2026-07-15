import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { isItemPureFx } from "~/v1/item/fx/purity/isItemPureFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { purityTestConfig } from "~test/line/support/purityTestConfig";

const location = {
	scope: "board" as const,
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
			session: {
				speedMode: "normal" as const,
			},
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
						session: {
							speedMode: "normal" as const,
						},
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
			session: {
				speedMode: "normal" as const,
			},
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
			session: {
				speedMode: "normal" as const,
			},
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
			session: {
				speedMode: "normal" as const,
			},
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
