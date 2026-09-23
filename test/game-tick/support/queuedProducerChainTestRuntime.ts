import { Effect } from "effect";

import { useGameFx } from "~test/support/useGameFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";

const simpleItem = (id: string) => ({
	maxQueueSize: 1,
	lines: [],

	uid: id,
	id,

	title: id,
	description: id,
	ui: "simple" as const,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
});

const outcome = (itemId: string) => ({
	set: [
		{
			rules: [],
			roll: [
				{
					type: "guaranteed" as const,
					outcome: [
						{
							type: "item" as const,
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
	query: {
		distance: "far",
		selector: {
			type: "item" as const,
			itemId,
		},
	},
	quantity: {
		min: 1,
		max: 1,
	},
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

	title: id,
	description: id,
	ui: "default" as const,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},

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
			outcome: outcome(outputItemId),
			rules: [],
		},
	],
});

const config = GameConfigSchema.parse({
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
	},
	start: {
		currentSpace: 0,
		spaces: [],
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

export const owners = {
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

export const runChain = (order: ReadonlyArray<keyof typeof owners>, space = 0) =>
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
						space,
						position: {
							x: index * 2,
							y: 0,
						},
					},
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
