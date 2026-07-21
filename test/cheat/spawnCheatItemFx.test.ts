import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { readCheatItemCatalogFx } from "~/engine/cheat/read/readCheatItemCatalogFx";
import { setCheatEnabledFx } from "~/engine/cheat/write/setCheatEnabledFx";
import { spawnCheatItemFx } from "~/engine/cheat/write/spawnCheatItemFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

describe("Cheat item spawning", () => {
	it("reads the compiled spawnable catalog and authorizes standard Board placement from persisted state", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const catalog = yield* readCheatItemCatalogFx();
				const before = yield* readRuntimeFx();
				const disabled = yield* Effect.either(
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
		expect(Either.isLeft(result.disabled)).toBe(true);
		if (Either.isLeft(result.disabled)) {
			expect(result.disabled.left).toMatchObject({
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
});
