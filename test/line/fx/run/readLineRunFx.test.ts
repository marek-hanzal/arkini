import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import { readLineRunFx } from "~/v1/line/fx/run/readLineRunFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { lineRunTestConfig } from "~test/line/fx/run/support/lineRunTestRuntime";

const ownerItemId = "runtime:workshop";
const lineId = "line:workshop:build";

const spawnOwnerFx = () => {
	return spawnItemFx({
		id: ownerItemId,
		itemId: "workshop",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		},
		quantity: 1,
	});
};

const spawnPermitFx = () => {
	return spawnItemFx({
		id: "runtime:permit",
		itemId: "permit",
		location: {
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		},
		quantity: 1,
	});
};

const storeWaterFx = ({ id, quantity, x }: { id: string; quantity: number; x: number }) => {
	return Effect.gen(function* () {
		const source = yield* spawnItemFx({
			id,
			itemId: "water",
			location: {
				scope: "board",
				space: 0,
				position: {
					x,
					y: 0,
				},
			},
			quantity,
		});
		yield* storeInputMaterialFx({
			ownerItemId,
			lineId,
			inputIndex: 0,
			sourceItemId: id,
			sourceItemRevision: source.revision,
			quantity,
		});
	});
};

describe("readLineRunFx", () => {
	it("recomputes the preview from the current runtime snapshot", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnPermitFx();
				yield* storeWaterFx({
					id: "runtime:water:a",
					quantity: 2,
					x: 1,
				});
				const before = yield* readLineRunFx({
					ownerItemId,
					lineId,
				});
				yield* storeWaterFx({
					id: "runtime:water:b",
					quantity: 1,
					x: 2,
				});
				const after = yield* readLineRunFx({
					ownerItemId,
					lineId,
				});

				return {
					after,
					before,
				};
			}).pipe(
				useGameFx({
					config: lineRunTestConfig,
				}),
			),
		);

		expect(result.before.ready).toBe(false);
		expect(result.before.plan).toBeUndefined();
		expect(result.after.ready).toBe(true);
		expect(result.after.plan?.input[0]).toMatchObject({
			type: "materials",
			quantity: 3,
		});
	});
});
