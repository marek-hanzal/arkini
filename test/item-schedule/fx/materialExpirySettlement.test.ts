import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { RuntimeStoreFx } from "~/game-runtime/context/RuntimeStoreFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { useGameFx } from "~test/support/useGameFx";
import { createTemporaryMaterialLifecycleTestConfig } from "./temporaryMaterialLifecycle.test/createTemporaryMaterialLifecycleTestConfig";

import { startMaterialJobFx, lastUnitConfigFn } from "./materialExpirySettlement.test/fixture";

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
	it("resolves committed material expiry immediately despite its line runtime and inputs", () => {
		const base = createTemporaryMaterialLifecycleTestConfig();
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				temporary: {
					...base.items.temporary,
					lines: [
						{
							...base.items.temporary!.lines[0]!,
							runtimeMs: 1_000,
							input: [
								{
									type: "materials",
									query: {
										distance: "far",
										selector: {
											type: "item",
											itemUid: "blocker",
										},
									},
									quantity: {
										min: 1,
										max: 1,
									},
									mode: "consume",
								},
							],
							outcome: base.items.owner!.lines[0]!.outcome,
						},
					],
				},
			},
		});
		const result = runFn(config);
		expect(result.expired.runtime.jobs).toEqual([]);
		expect(result.expired.runtime.items.some((item) => item.id === "input")).toBe(false);
		expect(
			result.expired.runtime.items.filter((item) => item.item.uid === "product"),
		).toHaveLength(1);
		expect(result.expired.events.filter((event) => event.type === "job:aborted")).toHaveLength(
			1,
		);
		expect(
			result.later.runtime.items.filter((item) => item.item.uid === "product"),
		).toHaveLength(1);
	});

	it("settles a last-unit owner through its termination Job after material expiry", () => {
		const config = lastUnitConfigFn("loose-kill");
		const result = runFn(config);
		expect(result.expired.runtime.jobs.map((job) => job.lineUid)).toEqual([
			"line:owner:termination",
		]);
		expect(
			result.later.runtime.items.some((item) => item.id === "owner" || item.id === "input"),
		).toBe(false);
		expect(result.later.runtime.jobs).toEqual([]);
		expect(
			result.later.runtime.items.filter((item) => item.item.uid === "residue"),
		).toHaveLength(1);
		expect(result.expired.events.filter((event) => event.type === "job:aborted")).toHaveLength(
			1,
		);
	});
});
