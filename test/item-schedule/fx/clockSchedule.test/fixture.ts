import { Effect } from "effect";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ItemScheduleSchema } from "~/item-schedule/schema/ItemScheduleSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import {
	createLine,
	createOutput,
	createProducerItem,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

export const createClockConfig = (
	overrides: Omit<Partial<ItemSchema.Type>, "clock"> & {
		clock?: Partial<ItemScheduleSchema.Type>;
	} = {},
) =>
	GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: "game:clock",
			title: "Clock",
			board: {
				width: 6,
				height: 2,
			},
		},
		start: {
			currentSpace: 0,
			spaces: [],
		},
		items: {
			clock: {
				...createProducerItem({
					id: "clock",
					lines: [
						{
							...createLine({
								id: "a",
								default: true,
								clock: true,
								outcome: createOutput([
									{
										itemUid: "result",
									},
								]),
							}),
							runtimeMs: 400,
						},
						{
							...createLine({
								id: "b",
								outcome: createOutput([
									{
										itemUid: "result",
									},
								]),
							}),
							runtimeMs: 100,
						},
					],
				}),

				maxQueueSize: 3,
				ui: "default",
				...overrides,
				clock: {
					intervalMs: 250,
					...overrides.clock,
				},
			},
			permit: {
				...createSimpleItem("permit"),
			},
			result: {
				...createSimpleItem("result"),
			},
			expired: {
				...createSimpleItem("expired"),
			},
		},
	});
export const spawnClockItemFx = (itemId = "clock", x = 0, y = 0) =>
	spawnItemFx({
		id: `runtime:${itemId}`,
		itemUid: itemId,

		location: {
			scope: "board",
			space: 0,
			position: {
				x,
				y,
			},
		},
	});
export const tickClockFx = Effect.fn("tickClockFx")(function* (elapsedMs: number) {
	yield* runTickRuntimeByFx({
		elapsedMs,
	});
	return yield* readRuntimeFx();
});
