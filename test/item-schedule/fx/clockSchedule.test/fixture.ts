import { Effect } from "effect";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ClockSchema } from "~/item-definition/schema/ClockSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import {
	createLine,
	createOutput,
	createProducerItem,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

export const createClockConfig = (clock: Partial<ClockSchema.Type> = {}) =>
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
			inventory: {
				width: 2,
				height: 2,
			},
		},
		start: {
			currentSpace: 0,
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
								output: createOutput([
									{
										itemId: "result",
									},
								]),
							}),
							runtimeMs: 400,
						},
						{
							...createLine({
								id: "b",
								output: createOutput([
									{
										itemId: "result",
									},
								]),
							}),
							runtimeMs: 100,
						},
					],
				}),
				type: "clock",
				scope: "board",
				maxStackSize: 1,
				maxQueueSize: 3,
				intervalMs: 250,
				control: "interactive",
				...clock,
			},
			permit: {
				...createSimpleItem("permit"),
				maxStackSize: 1,
			},
			result: {
				...createSimpleItem("result"),
				maxStackSize: 1,
			},
			expired: {
				...createSimpleItem("expired"),
				scope: "board",
				maxStackSize: 1,
			},
		},
	});
export const spawnClockItemFx = (itemId = "clock", x = 0, y = 0) =>
	spawnItemFx({
		id: `runtime:${itemId}`,
		itemId,
		quantity: 1,
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
