import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { enqueueLineFx } from "~/production-job/write/enqueueLineFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { TickStepMs } from "~/game-tick/TickStepMs";

const ownerKinds = [
	"producer",
	"craft",
	"blueprint",
] as const;

const baseItem = (id: string) => ({
	uid: id,
	id,
	title: id,
	description: id,
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	scope: "any" as const,
	maxStackSize: 1,
});

const makeLine = (lineId: string) => ({
	id: lineId,
	title: lineId,
	description: lineId,
	runtimeMs: 1_000,
	input: [
		{
			type: "materials" as const,
			selector: {
				type: "item" as const,
				itemId: "material",
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
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		material: {
			...baseItem("material"),
			type: "simple",
			maxStackSize: 10,
		},
		producer: {
			...baseItem("producer"),
			type: "producer",
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
			...baseItem("craft"),
			type: "craft",
			line: makeLine("line:craft"),
		},
		blueprint: {
			...baseItem("blueprint"),
			type: "blueprint",
			line: makeLine("line:blueprint"),
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
		itemId: ownerKind,
		location: boardLocation(0),
		quantity: 1,
	});
	yield* spawnItemFx({
		id: "runtime:material:a",
		itemId: "material",
		location: boardLocation(1),
		quantity: 1,
	});
	yield* spawnItemFx({
		id: "runtime:material:b",
		itemId: "material",
		location: boardLocation(2),
		quantity: 1,
	});
	return {
		lineId,
		ownerItemId,
	};
});

describe("line-owner delivery settlement boundary", () => {
	it.each(ownerKinds)(
		"keeps queued %s work blocked by engine-owned delivery travel until the next Tick",
		(ownerKind) => {
			const result = Effect.runSync(
				Effect.gen(function* () {
					const ids = yield* spawnScenarioFx(ownerKind);
					const request = yield* enqueueLineFx(ids);
					yield* runTickRuntimeByFx({
						elapsedMs: TickStepMs,
					});
					const traveling = yield* readRuntimeFx();
					yield* runTickRuntimeByFx({
						elapsedMs: TickStepMs * 2,
					});
					const settled = yield* readRuntimeFx();
					yield* runTickRuntimeByFx({
						elapsedMs: TickStepMs,
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
