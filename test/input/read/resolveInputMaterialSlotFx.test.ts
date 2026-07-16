import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { resolveInputMaterialSlotFx } from "~/engine/input/read/resolveInputMaterialSlotFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

describe("resolveInputMaterialSlotFx", () => {
	it("resolves one concrete slot from its buffered runtime items", () => {
		const resolution = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:workshop",
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation(1),
					quantity: 4,
				});
				yield* storeInputMaterialFx({
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					inputIndex: 0,
					sourceItemId: "runtime:water",
					sourceItemRevision: source.revision,
					quantity: 2,
				});

				return yield* resolveInputMaterialSlotFx({
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					inputIndex: 0,
				});
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(resolution).toEqual({
			type: "materials",
			mode: "consume",
			required: {
				min: 3,
				max: 3,
			},
			storedQuantity: 2,
			maxStoredQuantity: 5,
			runQuantity: 0,
			missingQuantity: 1,
			availableCapacity: 3,
			ready: false,
		});
	});
});
