import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { settleItemDeliveryFx } from "~/engine/delivery/write/settleItemDeliveryFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { setLineAutonomousFx } from "~/engine/line/write/setLineAutonomousFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

const workshop = inputRuntimeTestConfig.items.workshop;
if (workshop.type !== "producer") throw new Error("Expected producer test owner.");
const autonomousConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	items: {
		...inputRuntimeTestConfig.items,
		workshop: {
			...workshop,
			lines: workshop.lines.map((line) => ({
				...line,
				autonomous: true,
			})),
		},
	},
});
const twoAutonomousLineConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	items: {
		...inputRuntimeTestConfig.items,
		workshop: {
			...workshop,
			lines: [
				...workshop.lines.map((line) => ({
					...line,
					autonomous: true,
				})),
				{
					...workshop.lines[0],
					autonomous: true,
					id: "line:workshop:second",
					title: "Second",
				},
			],
		},
	},
});

const ownerItemId = "runtime:workshop";
const lineId = "line:workshop:build";

describe("setLineAutonomousFx", () => {
	it("rejects lines without authored capability", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: ownerItemId,
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				return yield* Effect.result(
					setLineAutonomousFx({
						enabled: true,
						ownerItemId,
						lineId,
					}),
				);
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "LineAutonomousUnavailableError",
				ownerItemId,
				lineId,
			});
		}
	});

	it("round-trips the player toggle and persists an explicit disable", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: ownerItemId,
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				yield* setLineAutonomousFx({
					enabled: true,
					ownerItemId,
					lineId,
				});
				const enabledState = yield* fromRuntimeFx({
					runtime: yield* readRuntimeFx(),
				});
				const hydrated = yield* fromStateFx({
					state: enabledState,
				});
				yield* setLineAutonomousFx({
					enabled: false,
					ownerItemId,
					lineId,
				});
				return {
					disabled: yield* readRuntimeFx(),
					enabledState,
					hydrated,
				};
			}).pipe(
				useGameFx({
					config: autonomousConfig,
				}),
			),
		);

		expect(result.enabledState.autonomousLines).toEqual([
			{
				ownerItemId,
				lineId,
			},
		]);
		expect(result.hydrated.autonomousLines).toEqual(result.enabledState.autonomousLines);
		expect(result.disabled.autonomousLines).toEqual([]);
	});

	it("downgrades an outbound autonomous intent when the player disables its line", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: ownerItemId,
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation(1),
					quantity: 3,
				});
				yield* setLineAutonomousFx({
					enabled: true,
					ownerItemId,
					lineId,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				yield* setLineAutonomousFx({
					enabled: false,
					ownerItemId,
					lineId,
				});
				yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: autonomousConfig,
				}),
			),
		);

		expect(runtime.autonomousLines).toEqual([]);
		expect(runtime.jobs).toHaveLength(0);
		expect(runtime.items.find(({ id }) => id === "runtime:water")?.location.scope).toBe(
			"input",
		);
	});

	it("keeps authored autonomous toggles independent per line", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: ownerItemId,
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				yield* setLineAutonomousFx({
					enabled: true,
					ownerItemId,
					lineId,
				});
				yield* setLineAutonomousFx({
					enabled: true,
					ownerItemId,
					lineId: "line:workshop:second",
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: twoAutonomousLineConfig,
				}),
			),
		);

		expect(runtime.autonomousLines).toEqual([
			{
				ownerItemId,
				lineId,
			},
			{
				ownerItemId,
				lineId: "line:workshop:second",
			},
		]);
	});

	it("does not admit autonomous physics in an unpresented board space", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: ownerItemId,
					itemId: "workshop",
					location: {
						...workshopLocation,
						space: 1,
					},
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: {
						...sourceLocation(1),
						space: 1,
					},
					quantity: 3,
				});
				yield* setLineAutonomousFx({
					enabled: true,
					ownerItemId,
					lineId,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: autonomousConfig,
				}),
			),
		);

		expect(runtime.jobs).toHaveLength(0);
		expect(runtime.items.some(({ location }) => location.scope === "delivery")).toBe(false);
	});

	it("persists player selection and advances each cycle through physical delivery", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: ownerItemId,
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation(1),
					quantity: 7,
				});
				yield* setLineAutonomousFx({
					enabled: true,
					ownerItemId,
					lineId,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				const outbound = yield* readRuntimeFx();
				yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				const started = yield* readRuntimeFx();
				yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 1,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 1_100,
				});
				return {
					outbound,
					started,
					nextCycle: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: autonomousConfig,
				}),
			),
		);

		expect(result.outbound.autonomousLines).toEqual([
			{
				ownerItemId,
				lineId,
			},
		]);
		expect(result.outbound.jobs).toHaveLength(0);
		expect(result.outbound.items.find(({ id }) => id === "runtime:water")).toMatchObject({
			location: {
				phase: "outbound",
				purpose: {
					kind: "fill-and-try-start",
					source: "autonomous",
				},
				scope: "delivery",
			},
			quantity: 7,
		});
		expect(result.started.jobs).toHaveLength(1);
		expect(result.nextCycle.jobs).toHaveLength(0);
		expect(result.nextCycle.items.find(({ id }) => id === "runtime:water")).toMatchObject({
			location: {
				phase: "outbound",
				scope: "delivery",
			},
			quantity: 4,
		});
	});
});
