import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";

const ownerKinds = [
	"producer",
	"craft",
] as const;

const baseItem = (id: string) => ({
	uid: id,

	title: id,
	description: id,
	ui: "default" as const,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
});

const makeLine = (lineId: string) => ({
	id: lineId,
	title: lineId,
	description: lineId,
	runtimeMs: 1_000,
	input: [
		{
			type: "materials" as const,
			query: {
				distance: "far" as const,
				selector: {
					type: "item" as const,
					itemUid: "material",
				},
			},
			quantity: {
				min: 2,
				max: 2,
			},
		},
	],
	rules: [],
});

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:line-owner-delivery-boundary",
		title: "Line owner delivery boundary",
		board: {
			width: 4,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		material: {
			maxQueueSize: 1,
			lines: [],

			...baseItem("material"),
		},
		producer: {
			...baseItem("producer"),

			maxQueueSize: 2,
			lines: [
				makeLine("line:producer"),
				{
					id: "line:producer:other",
					title: "Other producer work",
					description: "Keeps the owner busy while delivery settles.",
					runtimeMs: 1_000,
					input: [
						{
							type: "simple",
						},
					],
					rules: [],
				},
			],
		},
		craft: {
			maxQueueSize: 1,

			...baseItem("craft"),

			lines: [
				makeLine("line:craft"),
			],
		},
	},
});

const boardLocation = (x: number) =>
	({
		scope: "board",
		space: 0,
		position: {
			x,
			y: 0,
		},
	}) as const;

const spawnScenarioFx = Effect.fn("spawnLineOwnerDeliveryBoundaryScenarioFx")(function* (
	ownerKind: (typeof ownerKinds)[number],
) {
	const ownerItemId = `runtime:${ownerKind}`;
	const lineId = `line:${ownerKind}`;
	yield* spawnItemFx({
		id: ownerItemId,
		itemUid: ownerKind,
		location: boardLocation(0),
	});
	yield* spawnItemFx({
		id: "runtime:material:a",
		itemUid: "material",
		location: boardLocation(1),
	});
	yield* spawnItemFx({
		id: "runtime:material:b",
		itemUid: "material",
		location: boardLocation(2),
	});
	return {
		lineId,
		ownerItemId,
	};
});

describe("line-owner delivery settlement boundary", () => {
	it.each(ownerKinds)(
		"keeps queued %s work blocked by Delivery-owned travel until the next Tick",
		(ownerKind) => {
			const result = Effect.runSync(
				Effect.gen(function* () {
					const ids = yield* spawnScenarioFx(ownerKind);
					const request = yield* enqueueLineFx(ids);
					yield* runTickRuntimeByFx({
						elapsedMs: SimulationStepMs,
					});
					const traveling = yield* readRuntimeFx();
					yield* runTickRuntimeByFx({
						elapsedMs: SimulationStepMs * 2,
					});
					const settled = yield* readRuntimeFx();
					yield* runTickRuntimeByFx({
						elapsedMs: SimulationStepMs,
					});
					return {
						finished: yield* readRuntimeFx(),
						finishedTransition: yield* (yield* CommittedTransitionsFx).read,
						ids,
						request,
						settled,
						traveling,
					};
				}).pipe(
					useGameFx({
						config,
					}),
				),
			);

			expect(result.traveling.jobs).toEqual([]);
			expect(result.traveling.jobQueue).toEqual([
				result.request,
			]);
			expect(
				result.traveling.items.flatMap((item) =>
					item.location.scope === "delivery"
						? [
								item.location.remainingDurationMs,
							]
						: [],
				),
			).toEqual([
				200,
				200,
			]);
			expect(result.settled.jobs).toEqual([]);
			expect(result.settled.jobQueue).toEqual([
				result.request,
			]);
			expect(result.settled.items.some((item) => item.location.scope === "delivery")).toBe(
				false,
			);
			expect(result.finished.jobQueue).toEqual([]);
			expect(result.finished.jobs).toEqual([
				expect.objectContaining({
					lineId: result.ids.lineId,
					ownerItemId: result.ids.ownerItemId,
				}),
			]);
			expect(result.finishedTransition.events).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: "job:started",
					}),
				]),
			);
		},
	);
});
