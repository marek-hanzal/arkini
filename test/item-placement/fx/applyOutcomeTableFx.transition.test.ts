import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { removeRuntimeItemForTestFx } from "~test/item-interaction/support/removeRuntimeItemForTestFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import {
	boardLocation,
	configuredDrop,
	configuredOutput,
	placementTestConfig,
} from "~test/item-placement/support/placementTestConfig";
import { placeOutputForTestFx } from "~test/item-placement/support/placeOutputForTestFx";

describe("output placement transition", () => {
	it("places every output identity in its own cell across successive drops", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemUid: "origin",
					location: boardLocation(0),
				});

				const placement = yield* placeOutputForTestFx({
					originItemId: "runtime:origin",
					output: configuredOutput([
						configuredDrop({
							itemId: "log",
							placement: "drop",
							quantity: 2,
						}),
						configuredDrop({
							itemId: "log",
							placement: "drop",
							quantity: 1,
						}),
					]),
				});
				const runtime = yield* readRuntimeFx();

				return {
					placement,
					runtime,
				};
			}).pipe(
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		expect(result.placement.item[0]?.placement.spawn).toHaveLength(2);
		expect(result.placement.item[1]?.placement.spawn).toHaveLength(1);
		const logs = result.runtime.items.filter((item) => item.item.uid === "log");
		expect(logs.map((item) => item.location)).toEqual([
			boardLocation(1),
			boardLocation(2),
			boardLocation(3),
		]);
		expect(new Set(logs.map((item) => item.id)).size).toBe(3);
	});
});
it("resolves output rules from the same snapshot that it commits", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "runtime:origin",
				itemUid: "origin",
				location: boardLocation(0),
			});
			const permit = yield* spawnItemFx({
				id: "runtime:permit",
				itemUid: "permit",
				location: boardLocation(1),
			});
			const staleRuntime = yield* readRuntimeFx();
			yield* removeRuntimeItemForTestFx({
				itemId: "runtime:permit",
				revision: permit.revision,
			});

			const placement = yield* placeOutputForTestFx({
				originItemId: "runtime:origin",
				output: configuredOutput([
					configuredDrop({
						itemId: "log",
						placement: "drop",
						quantity: 1,
						rules: [
							{
								type: "enable",
								when: [
									{
										type: "exists",
										query: {
											distance: "far" as const,
											selector: {
												type: "item",
												itemUid: "permit",
											},
										},
									},
								],
							},
						],
					}),
				]),
			}).pipe(
				Effect.provideService(RuntimeFx, {
					read: Effect.succeed(staleRuntime),
				}),
			);
			const runtime = yield* readRuntimeFx();

			return {
				placement,
				runtime,
			};
		}).pipe(
			useGameFx({
				config: placementTestConfig,
			}),
		),
	);

	expect(result.placement.item).toEqual([]);
	expect(result.runtime.items.some((item) => item.item.uid === "log")).toBe(false);
});

it("rolls back every earlier drop when a later drop cannot be placed", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "runtime:origin",
				itemUid: "origin",
				location: boardLocation(0),
			});
			yield* spawnItemFx({
				id: "runtime:blocker:2",
				itemUid: "blocker",
				location: boardLocation(2),
			});
			yield* spawnItemFx({
				id: "runtime:blocker:3",
				itemUid: "blocker",
				location: boardLocation(3),
			});
			for (const {} of [
				0,
				1,
			]) {
			}
			const before = yield* readRuntimeFx();
			const placement = yield* Effect.result(
				placeOutputForTestFx({
					originItemId: "runtime:origin",
					output: configuredOutput([
						configuredDrop({
							itemId: "board-only",
							placement: "drop",
							quantity: 1,
						}),
						configuredDrop({
							itemId: "board-only",
							placement: "drop",
							quantity: 1,
						}),
					]),
				}),
			);
			const after = yield* readRuntimeFx();

			return {
				after,
				before,
				placement,
			};
		}).pipe(
			useGameFx({
				config: placementTestConfig,
			}),
		),
	);

	expect(Result.isFailure(result.placement)).toBe(true);
	if (Result.isFailure(result.placement)) {
		expect(result.placement.failure).toMatchObject({
			_tag: "PlacementUnavailableError",
			reason: "board:full",
		});
	}
	expect(result.after).toEqual(result.before);
});
