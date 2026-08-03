import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { settleItemDeliveryFx } from "~/engine/delivery/write/settleItemDeliveryFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { enqueueLineFx } from "~/engine/job/write/enqueueLineFx";
import { readCommittedTransitionFx } from "~/engine/runtime/read/readCommittedTransitionFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";
import { TickStepMs } from "~/engine/tick/TickStepMs";

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
				type: "value" as const,
				value: 2,
			},
		},
	],
	rules: [],
});

const config = GameConfigSchema.parse({
	version: "1.0",
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
	it.each(
		ownerKinds,
	)("keeps queued %s work persisted until deliveries settle and a later Tick admits it", (ownerKind) => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const ids = yield* spawnScenarioFx(ownerKind);
				const request = yield* enqueueLineFx(ids);
				yield* runTickRuntimeByFx({
					elapsedMs: TickStepMs,
				});
				const admitted = yield* readRuntimeFx();
				yield* settleItemDeliveryFx({
					itemId: "runtime:material:a",
					generation: 0,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: TickStepMs,
				});
				const afterFirstContact = yield* readRuntimeFx();
				yield* settleItemDeliveryFx({
					itemId: "runtime:material:b",
					generation: 0,
				});
				const afterLastContact = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: TickStepMs,
				});
				return {
					admitted,
					afterFirstContact,
					afterLastContact,
					finished: yield* readRuntimeFx(),
					finishedTransition: yield* readCommittedTransitionFx(),
					ids,
					request,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.admitted.jobs).toEqual([]);
		expect(result.admitted.jobQueue).toEqual([
			result.request,
		]);
		expect(result.afterFirstContact.jobs).toEqual([]);
		expect(result.afterFirstContact.jobQueue).toEqual([
			result.request,
		]);
		expect(result.afterLastContact.jobs).toEqual([]);
		expect(result.afterLastContact.jobQueue).toEqual([
			result.request,
		]);
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
	});
});
