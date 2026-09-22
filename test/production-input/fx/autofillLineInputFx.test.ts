import { Effect } from "effect";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { expect, it } from "vitest";
import { autofillLineInputFx } from "~/production-input/fx/autofillLineInputFx";
import { autofillLineInputsFx } from "~test/support/autofillLineInputsFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { useGameFx } from "~test/support/useGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import {
	inputRuntimeTestConfig,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";

const target = {
	ownerItemId: "runtime:workshop",
	lineId: "line:workshop:build",
	inputIndex: 1,
};
const workshop = inputRuntimeTestConfig.items.workshop;
// Two compatible slots expose accidental allocation to a sibling before filtering the plan.
const config = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	items: {
		...inputRuntimeTestConfig.items,
		workshop: {
			...workshop,
			lines: workshop.lines.map((line) => ({
				...line,
				input: [
					line.input[0],
					{
						...line.input[0],
						mode: "reserve",
					},
					...line.input.slice(1),
				],
			})),
		},
	},
});
const spawnOwnerFx = () =>
	spawnItemFx({
		id: target.ownerItemId,
		itemId: "workshop",
		location: workshopLocation,
	});
const spawnWaterFx = (count: number) =>
	Effect.forEach(
		Array.from(
			{
				length: count,
			},
			(_, index) => index,
		),
		(index) =>
			spawnItemFx({
				id: index === 0 ? "runtime:water" : `runtime:water:${index}`,
				itemId: "water",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: (index + 1) % 5,
						y: Math.floor((index + 1) / 5),
					},
				},
			}),
	);

it("targets only the clicked reserve slot, accounts for incoming stock and settles via ordinary delivery without starting work", () => {
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnOwnerFx();
			const transitions = yield* CommittedTransitionsFx;
			const beforeEmpty = yield* transitions.read;
			expect(yield* autofillLineInputFx(target)).toBe(0);
			expect((yield* transitions.read).sequence).toBe(beforeEmpty.sequence);
			yield* spawnWaterFx(7);
			expect(yield* autofillLineInputFx(target)).toBe(3);
			const delivering = yield* readRuntimeFx();
			expect(delivering.items.find((item) => item.id === "runtime:water")).toMatchObject({
				location: {
					scope: "delivery",
					target: {
						kind: "line-input",
						ownerItemId: target.ownerItemId,
						lineId: target.lineId,
						inputIndex: 1,
					},
				},
			});
			expect(delivering.items.some((item) => item.location.scope === "input")).toBe(false);
			yield* spawnItemFx({
				id: "runtime:extra",
				itemId: "water",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 4,
						y: 1,
					},
				},
			});
			const beforeRetry = yield* readRuntimeFx();
			expect(yield* autofillLineInputFx(target)).toBe(0);
			expect(yield* readRuntimeFx()).toEqual(beforeRetry);
			yield* runTickRuntimeByFx({
				elapsedMs: 2000,
			});
			const settled = yield* readRuntimeFx();
			const buffered = settled.items.filter((item) => item.location.scope === "input");
			expect(buffered).toHaveLength(3);
			for (const item of buffered)
				expect(item.location).toMatchObject({
					ownerItemId: target.ownerItemId,
					lineId: target.lineId,
					inputIndex: 1,
				});
			expect(settled.jobs).toEqual([]);
			expect(settled.jobQueue).toEqual([]);
			expect(settled.items.filter((item) => item.item.id === "water")).toHaveLength(8);
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
});

it("rejects a stale fill click after even one piece arrives and leaves all material untouched", () => {
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnOwnerFx();
			yield* spawnWaterFx(1);
			expect(
				yield* autofillLineInputFx({
					...target,
					inputIndex: 0,
				}),
			).toBe(1);
			yield* runTickRuntimeByFx({
				elapsedMs: 2000,
			});
			yield* spawnItemFx({
				id: "runtime:extra",
				itemId: "water",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 4,
						y: 1,
					},
				},
			});
			const before = yield* readRuntimeFx();
			expect(
				yield* Effect.flip(
					autofillLineInputFx({
						...target,
						inputIndex: 0,
					}),
				),
			).toMatchObject({
				_tag: "LineInputNotEmptyError",
			});
			expect(yield* readRuntimeFx()).toEqual(before);
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
});

it("rejects a fill click once its line has started, preserving committed material", () => {
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnOwnerFx();
			yield* spawnWaterFx(7);
			yield* autofillLineInputsFx(target);
			yield* runTickRuntimeByFx({
				elapsedMs: 2000,
			});
			yield* enqueueLineFx(target);
			yield* runTickRuntimeByFx({
				elapsedMs: 100,
			});
			const before = yield* readRuntimeFx();
			expect(before.jobs).toHaveLength(1);
			expect(yield* Effect.flip(autofillLineInputFx(target))).toMatchObject({
				_tag: "LineInputClosedError",
			});
			expect(yield* readRuntimeFx()).toEqual(before);
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
});

it("rejects simple UI ownership and invalid slots before moving any source", () => {
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnOwnerFx();
			yield* spawnWaterFx(7);
			const before = yield* readRuntimeFx();
			expect(yield* Effect.flip(autofillLineInputFx(target))).toMatchObject({
				_tag: "ItemProductionControlUnavailableError",
			});
			expect(yield* readRuntimeFx()).toEqual(before);
		}).pipe(
			useGameFx({
				config: GameConfigSchema.parse({
					...config,
					items: {
						...config.items,
						workshop: {
							...config.items.workshop,
							ui: "simple",
						},
					},
				}),
			}),
		),
	);
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnOwnerFx();
			yield* spawnWaterFx(7);
			const before = yield* readRuntimeFx();
			expect(
				yield* Effect.flip(
					autofillLineInputFx({
						...target,
						inputIndex: 2,
					}),
				),
			).toMatchObject({
				_tag: "InputMaterialNotFoundError",
			});
			expect(yield* readRuntimeFx()).toEqual(before);
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
});
