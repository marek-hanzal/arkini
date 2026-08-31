import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { readCheatItemCatalogFx } from "~/game-cheat/fx/readCheatItemCatalogFx";
import { removeCheatItemFx } from "~/game-cheat/fx/removeCheatItemFx";
import { setCheatEnabledFx } from "~/game-cheat/fx/setCheatEnabledFx";
import { spawnCheatItemFx } from "~/game-cheat/fx/spawnCheatItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

describe("Cheat item spawning", () => {
	it("reads the compiled spawnable catalog and authorizes standard Board placement from persisted state", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const catalog = yield* readCheatItemCatalogFx();
				const before = yield* readRuntimeFx();
				const disabled = yield* Effect.result(
					spawnCheatItemFx({
						itemId: "water",
					}),
				);
				const afterDisabled = yield* readRuntimeFx();
				yield* setCheatEnabledFx({
					enabled: true,
				});
				const placement = yield* spawnCheatItemFx({
					itemId: "water",
				});
				const afterSpawn = yield* readRuntimeFx();
				return {
					afterDisabled,
					afterSpawn,
					before,
					catalog,
					disabled,
					placement,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(result.catalog.map((entry) => entry.itemId)).toEqual([
			"forge",
			"tool",
			"water",
		]);
		expect(Result.isFailure(result.disabled)).toBe(true);
		if (Result.isFailure(result.disabled)) {
			expect(result.disabled.failure).toMatchObject({
				_tag: "CheatModeDisabledError",
				command: "spawn-item",
			});
		}
		expect(result.afterDisabled).toEqual(result.before);
		expect(result.placement.spawn).toHaveLength(1);
		expect(result.afterSpawn.items).toContainEqual(
			expect.objectContaining({
				item: expect.objectContaining({
					id: "water",
				}),
				location: expect.objectContaining({
					scope: "board",
					space: 0,
				}),
				quantity: 1,
			}),
		);
	});

	it("authorizes canonical item removal only from the exact save-scoped Cheat mode", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* setCheatEnabledFx({
					enabled: true,
				});
				yield* spawnCheatItemFx({
					itemId: "water",
				});
				const spawnedRuntime = yield* readRuntimeFx();
				const spawned = spawnedRuntime.items.find((item) => item.item.id === "water");
				if (spawned === undefined) return yield* Effect.die("Expected spawned Cheat item.");
				yield* setCheatEnabledFx({
					enabled: false,
				});
				const disabled = yield* Effect.result(
					removeCheatItemFx({
						itemId: spawned.id,
						revision: spawned.revision,
					}),
				);
				const afterDisabled = yield* readRuntimeFx();
				yield* setCheatEnabledFx({
					enabled: true,
				});
				const removed = yield* removeCheatItemFx({
					itemId: spawned.id,
					revision: spawned.revision,
				});
				const afterRemoved = yield* readRuntimeFx();
				return {
					afterDisabled,
					afterRemoved,
					disabled,
					removed,
					spawned,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(Result.isFailure(result.disabled)).toBe(true);
		if (Result.isFailure(result.disabled)) {
			expect(result.disabled.failure).toMatchObject({
				_tag: "CheatModeDisabledError",
				command: "remove-item",
			});
		}
		expect(result.afterDisabled.items).toContainEqual(result.spawned);
		expect(result.removed).toEqual(result.spawned);
		expect(result.afterRemoved.items).not.toContainEqual(
			expect.objectContaining({
				id: result.spawned.id,
			}),
		);
	});
});
