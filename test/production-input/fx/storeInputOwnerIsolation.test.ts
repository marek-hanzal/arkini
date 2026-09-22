import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { isItemPureFn } from "~/game-runtime/fn/isItemPureFn";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";

const spawnOwnerFx = (quantity: number) =>
	spawnItemFx({
		id: "runtime:workshop",
		itemId: "workshop",
		location: workshopLocation,
		quantity,
	});

const spawnSourceFx = (quantity: number) => {
	return spawnItemFx({
		id: "runtime:water",
		itemId: "water",
		location: sourceLocation(1),
		quantity,
	});
};

const storeFx = Effect.fn("storeOwnerIsolationMaterialFx")(function* (quantity: number) {
	const runtime = yield* readRuntimeFx();
	const source = runtime.items.find((item) => item.id === "runtime:water");
	if (source === undefined) throw new Error("Expected water source.");

	return yield* storeInputMaterialFx({
		ownerItemId: "runtime:workshop",
		lineId: "line:workshop:build",
		inputIndex: 0,
		sourceItemId: source.id,
		sourceItemRevision: source.revision,
		quantity,
	});
});

describe("input state owner isolation", () => {
	it("keeps the original owner identity stateful and reuses a fully consumed source cell", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx(2);
				yield* spawnSourceFx(1);
				const stored = yield* storeFx(1);
				const runtime = yield* readRuntimeFx();
				const owner = runtime.items.find((item) => item.id === "runtime:workshop");
				const remainder = runtime.items.find(
					(item) => item.item.id === "workshop" && item.id !== "runtime:workshop",
				);
				if (owner === undefined || remainder === undefined) {
					throw new Error("Expected isolated workshop owner and remainder.");
				}

				return {
					stored,
					owner,
					ownerPure: isItemPureFn({
						item: owner,
						runtime,
					}),
					remainder,
					remainderPure: isItemPureFn({
						item: remainder,
						runtime,
					}),
					runtime,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.stored.sourceBefore).toMatchObject({
			id: "runtime:water",
			location: sourceLocation(1),
			quantity: 1,
		});
		expect(result.stored.ownerItem).toEqual(result.owner);
		expect(result.owner).toMatchObject({
			id: "runtime:workshop",
			location: workshopLocation,
			quantity: 1,
		});
		expect(result.ownerPure).toBe(false);
		expect(result.remainder).toMatchObject({
			location: sourceLocation(1),
			quantity: 1,
		});
		expect(result.remainderPure).toBe(true);
		expect(
			result.runtime.items.find((item) => item.id === "runtime:water")?.location,
		).toMatchObject({
			scope: "input",
			ownerItemId: "runtime:workshop",
		});
	});
});
