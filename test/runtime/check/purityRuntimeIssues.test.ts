import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { checkRuntimeFx } from "~/v1/runtime/check/checkRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { purityTestConfig } from "~test/line/support/purityTestConfig";

const board = (x: number) => ({
	scope: "board" as const,
	position: {
		x,
		y: 0,
	},
});

describe("runtime purity invariants", () => {
	it("reports the effective singleton stack limit and buffered closed input", () => {
		const runtime = {
			items: [
				{
					id: "runtime:craft",
					item: purityTestConfig.items.craft,
					location: board(0),
					quantity: 2,
					revision: "revision:craft",
				},
				{
					id: "runtime:material",
					item: purityTestConfig.items.material,
					location: {
						scope: "input" as const,
						ownerItemId: "runtime:craft",
						lineId: "line:craft",
						inputIndex: 0,
					},
					quantity: 1,
					revision: "revision:material",
				},
			],
			jobs: [
				{
					id: "job:craft",
					ownerItemId: "runtime:craft",
					lineId: "line:craft",
					durationMs: 1_000,
					remainingMs: 1_000,
				},
			],
		} satisfies RuntimeSchema.Type;

		const result = Effect.runSync(
			checkRuntimeFx({
				runtime,
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(result.issues).toEqual([
			{
				canonicalItemId: "craft",
				itemId: "runtime:craft",
				maxStackSize: 1,
				quantity: 2,
				type: "item:stack-size",
			},
			{
				ownerItemId: "runtime:craft",
				lineId: "line:craft",
				inputIndex: 0,
				itemIds: [
					"runtime:material",
				],
				type: "line:input-closed",
			},
		]);
	});

	it.each([
		{
			name: "buffered input",
			items: [
				{
					id: "runtime:material",
					item: purityTestConfig.items.material,
					location: {
						scope: "input" as const,
						ownerItemId: "runtime:producer",
						lineId: "line:producer:buffer",
						inputIndex: 0,
					},
					quantity: 1,
					revision: "revision:material",
				},
			],
			jobs: [],
			jobQueue: [],
		},
		{
			name: "active job",
			items: [],
			jobs: [
				{
					id: "job:producer",
					ownerItemId: "runtime:producer",
					lineId: "line:producer:buffer",
					durationMs: 1_000,
					remainingMs: 1_000,
				},
			],
			jobQueue: [],
		},
		{
			name: "queued request",
			items: [],
			jobs: [],
			jobQueue: [
				{
					id: "request:producer",
					ownerItemId: "runtime:producer",
					lineId: "line:producer:buffer",
				},
			],
		},
	])("rejects an impure producer stack with $name", ({ items, jobs, jobQueue }) => {
		const runtime = {
			items: [
				{
					id: "runtime:producer",
					item: purityTestConfig.items.producer,
					location: board(0),
					quantity: 2,
					revision: "revision:producer",
				},
				...items,
			],
			jobs,
			jobQueue,
		} satisfies RuntimeSchema.Type;

		const result = Effect.runSync(
			checkRuntimeFx({
				runtime,
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(result.issues).toContainEqual({
			canonicalItemId: "producer",
			itemId: "runtime:producer",
			maxStackSize: 1,
			quantity: 2,
			type: "item:stack-size",
		});
	});

	it("keeps a pure producer stack at its configured limit", () => {
		const runtime = {
			items: [
				{
					id: "runtime:producer",
					item: purityTestConfig.items.producer,
					location: board(0),
					quantity: 2,
					revision: "revision:producer",
				},
			],
			jobs: [],
		} satisfies RuntimeSchema.Type;

		const result = Effect.runSync(
			checkRuntimeFx({
				runtime,
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(result.issues).toEqual([]);
	});

	it("allows buffered input on a running positive-capacity line", () => {
		const runtime = {
			items: [
				{
					id: "runtime:producer",
					item: purityTestConfig.items.producer,
					location: board(0),
					quantity: 1,
					revision: "revision:producer",
				},
				{
					id: "runtime:material",
					item: purityTestConfig.items.material,
					location: {
						scope: "input" as const,
						ownerItemId: "runtime:producer",
						lineId: "line:producer:buffer",
						inputIndex: 0,
					},
					quantity: 1,
					revision: "revision:material",
				},
			],
			jobs: [
				{
					id: "job:producer",
					ownerItemId: "runtime:producer",
					lineId: "line:producer:buffer",
					durationMs: 1_000,
					remainingMs: 1_000,
				},
			],
		} satisfies RuntimeSchema.Type;

		const result = Effect.runSync(
			checkRuntimeFx({
				runtime,
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(result.issues).toEqual([]);
	});
});
