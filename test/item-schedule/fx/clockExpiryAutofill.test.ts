import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { createLine } from "~test/game-config-validation/support/gameValidationTestSource";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { createClockConfig, spawnClockItemFx, tickClockFx } from "./clockSchedule.test/fixture";

const runRangePulseFx = (durationMs: number) =>
	Effect.gen(function* () {
		yield* spawnClockItemFx();
		const material = yield* spawnClockItemFx("permit", 1);
		yield* storeInputMaterialFx({
			ownerItemId: "runtime:clock",
			lineId: "range",
			inputIndex: 0,
			sourceItemId: material.id,
			sourceItemRevision: material.revision,
		});
		const spare = yield* spawnItemFx({
			id: "spare",
			itemUid: "permit",

			location: {
				scope: "board",
				space: 0,
				position: {
					x: 2,
					y: 0,
				},
			},
		});
		const pulsed = yield* tickClockFx(100);
		const settled = yield* tickClockFx(500);
		return {
			pulsed,
			settled,
			spare,
		};
	}).pipe(
		useGameFx({
			config: createClockConfig({
				lines: [
					{
						...createLine({
							id: "range",
							clock: true,
							input: [
								{
									type: "materials",
									query: {
										distance: "far",
										selector: {
											type: "item",
											itemUid: "permit",
										},
									},
									mode: "consume",
									quantity: {
										min: 1,
										max: 2,
									},
								},
							],
						}),
						runtimeMs: 500,
					},
				],
				clock: {
					intervalMs: 100,
					durationMs,
				},
			}),
		}),
	);

describe("Clock expiry and optional Autofill", () => {
	it("runs a startable final pulse without collecting an optional range top-up", () => {
		const { pulsed, settled, spare } = Effect.runSync(runRangePulseFx(100));

		expect(pulsed.jobs).toMatchObject([
			{
				ownerItemId: "runtime:clock",
				lineId: "range",
				remainingMs: 500,
			},
		]);
		expect(pulsed.jobQueue).toEqual([]);
		expect(pulsed.items.find((item) => item.id === spare.id)).toEqual(spare);
		expect(pulsed.items.find((item) => item.id === "runtime:permit")?.location.scope).toBe(
			"job",
		);
		expect(settled.jobs).toEqual([]);
		expect(settled.items).toEqual([
			spare,
		]);
	});

	it("still collects the optional range top-up while lifetime remains", () => {
		const { pulsed } = Effect.runSync(runRangePulseFx(1000));

		expect(pulsed.jobs).toEqual([]);
		expect(pulsed.jobQueue).toMatchObject([
			{
				ownerItemId: "runtime:clock",
				lineId: "range",
			},
		]);
		expect(pulsed.items.find((item) => item.id === "spare")?.location).toMatchObject({
			scope: "delivery",
			phase: "outbound",
		});
	});
});
