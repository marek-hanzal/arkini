import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { settleItemDeliveryFx } from "~/engine/delivery/write/settleItemDeliveryFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { enqueueLineFx } from "~/engine/job/write/enqueueLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";

const simpleItem = (id: string) => ({
	uid: id,
	id,
	type: "simple" as const,
	title: id,
	description: id,
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	scope: "any" as const,
	maxStackSize: 10,
});

const output = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					type: "guaranteed" as const,
					drop: [
						{
							itemId,
							quantity: {
								min: 1,
								max: 1,
							},
							placement: "drop" as const,
							rules: [],
						},
					],
				},
			],
		},
	],
});

const materialInput = (itemId: string) => ({
	type: "materials" as const,
	selector: {
		type: "item" as const,
		itemId,
	},
	quantity: {
		min: 1,
		max: 1,
	},
	capacity: 1,
	mode: "consume" as const,
});

const producer = ({
	id,
	input,
	outputItemId,
}: {
	id: string;
	input: ReturnType<typeof materialInput> | null;
	outputItemId: string;
}) => ({
	uid: id,
	id,
	type: "producer" as const,
	title: id,
	description: id,
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	scope: "board" as const,
	maxStackSize: 1,
	maxQueueSize: 4,
	lines: [
		{
			id: `line:${id}:run`,
			title: "Run",
			description: "Run",
			runtimeMs: 100,
			input:
				input === null
					? [
							{
								type: "simple" as const,
							},
						]
					: [
							input,
						],
			output: output(outputItemId),
			rules: [],
		},
	],
});

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:queued-producer-chain",
		title: "Queued producer chain",
		board: {
			width: 8,
			height: 3,
		},
		inventory: {
			width: 3,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		producerA: producer({
			id: "producerA",
			input: null,
			outputItemId: "raw",
		}),
		producerB: producer({
			id: "producerB",
			input: materialInput("raw"),
			outputItemId: "intermediate",
		}),
		producerC: producer({
			id: "producerC",
			input: materialInput("intermediate"),
			outputItemId: "final",
		}),
		raw: simpleItem("raw"),
		intermediate: simpleItem("intermediate"),
		final: simpleItem("final"),
	},
});

const owners = {
	A: {
		ownerItemId: "runtime:producer:A",
		lineId: "line:producerA:run",
	},
	B: {
		ownerItemId: "runtime:producer:B",
		lineId: "line:producerB:run",
	},
	C: {
		ownerItemId: "runtime:producer:C",
		lineId: "line:producerC:run",
	},
} as const;

const runChain = (order: ReadonlyArray<keyof typeof owners>) =>
	Effect.runSync(
		Effect.gen(function* () {
			for (const [index, key] of (
				[
					"A",
					"B",
					"C",
				] as const
			).entries()) {
				yield* spawnItemFx({
					id: owners[key].ownerItemId,
					itemId: `producer${key}`,
					location: {
						scope: "board",
						space: 0,
						position: {
							x: index * 2,
							y: 0,
						},
					},
					quantity: 1,
				});
			}

			for (const key of order) {
				yield* enqueueLineFx(owners[key]);
			}

			const queued = yield* readRuntimeFx();
			let settledSteps = 0;
			for (; settledSteps < 100; settledSteps += 1) {
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				const runtime = yield* readRuntimeFx();
				for (const item of runtime.items) {
					if (item.location.scope !== "delivery") continue;
					yield* settleItemDeliveryFx({
						itemId: item.id,
						generation: item.location.generation,
					});
				}
				const settled = yield* readRuntimeFx();
				if (
					settled.jobs.length === 0 &&
					settled.jobQueue.length === 0 &&
					settled.items.every((item) => item.location.scope !== "delivery")
				) {
					break;
				}
			}
			return {
				queued,
				settledSteps,
				completed: yield* readRuntimeFx(),
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);

describe("queued producer chain", () => {
	it.each([
		{
			name: "upstream first",
			order: [
				"A",
				"B",
				"C",
			] as const,
		},
		{
			name: "downstream first",
			order: [
				"C",
				"B",
				"A",
			] as const,
		},
	])("plays a concrete A -> B -> C chain with $name enqueue", ({ order }) => {
		const result = runChain(order);

		expect(result.queued.jobQueue.map((request) => request.ownerItemId)).toEqual(
			order.map((key) => owners[key].ownerItemId),
		);
		expect(result.settledSteps).toBeLessThan(100);
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.jobQueue).toEqual([]);
		expect(result.completed.items.filter((item) => item.item.id === "raw")).toEqual([]);
		expect(result.completed.items.filter((item) => item.item.id === "intermediate")).toEqual(
			[],
		);
		expect(
			result.completed.items
				.filter((item) => item.item.id === "final")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBe(1);
		expect(
			result.completed.items.some(
				(item) => item.location.scope === "job" || item.location.scope === "reserved",
			),
		).toBe(false);
	});
});
