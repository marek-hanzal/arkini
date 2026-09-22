import { spawnItemFx } from "~test/support/spawnItemFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { RuntimeStoreFx } from "~/game-runtime/context/RuntimeStoreFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { useGameFx } from "~test/support/useGameFx";
import { createTemporaryMaterialLifecycleTestConfig } from "./temporaryMaterialLifecycle.test/createTemporaryMaterialLifecycleTestConfig";

import {
	startMaterialJobFx,
	lastUnitConfigFn,
	prepareMaterialOwnerFx,
	boardFn,
} from "./materialExpirySettlement.test/fixture";

const runFn = (config: GameConfigSchema.Type) =>
	Effect.runSync(
		Effect.gen(function* () {
			yield* startMaterialJobFx();
			const store = yield* RuntimeStoreFx;
			yield* runTickRuntimeByFx({
				elapsedMs: 600,
			});
			const expired = yield* store.read;
			yield* runTickRuntimeByFx({
				elapsedMs: 600,
			});
			return {
				expired,
				later: yield* store.read,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);

describe("committed material expiry settlement", () => {
	it("places expiry output once after aborting the material owner job", () => {
		const base = createTemporaryMaterialLifecycleTestConfig();
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				temporary: {
					...base.items.temporary,
					clock: {
						...base.items.temporary!.clock,
						onExpire: base.items.owner!.lines[0]!.output,
					},
				},
			},
		});
		const result = runFn(config);
		expect(result.expired.runtime.jobs).toEqual([]);
		expect(result.expired.runtime.items.some((item) => item.id === "input")).toBe(false);
		expect(
			result.expired.runtime.items.filter((item) => item.item.id === "product"),
		).toHaveLength(1);
		expect(result.expired.events.filter((event) => event.type === "job:aborted")).toHaveLength(
			1,
		);
		expect(
			result.later.runtime.items.filter((item) => item.item.id === "product"),
		).toHaveLength(1);
	});

	it.each([
		"loose-kill",
		"kill-switch",
	] as const)("settles a last-unit owner when its material aborts under %s", (expiryMode) => {
		const config = lastUnitConfigFn(expiryMode);
		const output = config.items.owner!.units!.output!;
		output.set[0]!.roll[0]!.drop[0]!.rules = [
			{
				type: "enable",
				when: [
					{
						type: "exists",
						query: {
							distance: "self",
							selector: {
								type: "item",
								itemId: "owner",
							},
						},
					},
				],
			},
		];
		// Both outputs must still see the owner removed earlier in the same candidate.
		config.items.temporary!.clock!.onExpire = output;

		const result = runFn(config);
		expect(result.expired.runtime.jobs).toEqual([]);
		expect(
			result.expired.runtime.items.some((item) => item.id === "owner" || item.id === "input"),
		).toBe(false);
		expect(result.expired.runtime.items.some((item) => item.item.id === "product")).toBe(false);
		expect(
			result.expired.runtime.items.filter((item) => item.item.id === "residue"),
		).toHaveLength(1);
		expect(
			result.expired.events.filter((event) => event.type === "item:depleted"),
		).toHaveLength(1);
		expect(result.expired.events.filter((event) => event.type === "job:aborted")).toHaveLength(
			1,
		);
		expect(
			result.expired.runtime.items.find((item) => item.item.id === "residue")?.quantity,
		).toBe(2);
		expect(result.later.sequence).toBe(result.expired.sequence);
		expect(
			result.later.runtime.items.filter((item) => item.item.id === "residue"),
		).toHaveLength(1);
	});
	it("returns a reserved identity into the depleted owner's freed cell", () => {
		const config = lastUnitConfigFn("loose-kill");
		config.items.owner!.units!.output = undefined;
		config.items.owner!.lines[0]!.input.push({
			type: "materials",
			query: {
				distance: "self",
				selector: {
					type: "item",
					itemId: "blocker",
				},
			},
			mode: "reserve",
			quantity: {
				min: 1,
				max: 1,
			},
		});
		config.items.blocker!.clock = {
			durationMs: 10_000,
			enable: true,
			rules: [],
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareMaterialOwnerFx();
				const reserved = yield* spawnItemFx({
					id: "reserved",
					itemId: "blocker",
					quantity: 1,
					location: boardFn(1),
				});
				yield* storeInputMaterialFx({
					ownerItemId: "owner",
					lineId: "line:owner",
					inputIndex: 1,
					sourceItemId: reserved.id,
					sourceItemRevision: reserved.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: "owner",
					lineId: "line:owner",
				});
				for (const x of [
					1,
					2,
				])
					yield* spawnItemFx({
						id: `blocker:${x}`,
						itemId: "blocker",
						quantity: 1,
						location: boardFn(x),
					});
				yield* runTickRuntimeByFx({
					elapsedMs: 600,
				});
				return yield* (yield* RuntimeStoreFx).read;
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.items.some((item) => item.id === "owner")).toBe(false);
		expect(result.runtime.items.find((item) => item.id === "reserved")).toMatchObject({
			location: boardFn(0),
			schedule: {
				remainingDurationMs: 9_400,
			},
		});
	});
});
