import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { readPlacementOriginFx } from "~/v1/placement/fx/readPlacementOriginFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import {
	inventoryLocation,
	placementTestConfig,
} from "~test/placement/fx/support/placementTestConfig";

describe("readPlacementOriginFx", () => {
	it("rejects inventory coordinates as a board placement origin", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:inventory-origin",
					itemId: "blocker",
					location: inventoryLocation(0),
					quantity: 1,
				});
				return yield* Effect.either(
					readPlacementOriginFx({
						originItemId: "runtime:inventory-origin",
						runtime: yield* readRuntimeFx(),
					}),
				);
			}).pipe(
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "ItemNotOnBoardError",
				itemId: "runtime:inventory-origin",
				location: inventoryLocation(0),
			});
		}
	});
});
