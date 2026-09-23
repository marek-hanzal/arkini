import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { readItemPhysicalContextFx } from "~/item-location/fx/readItemPhysicalContextFx";
import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import { createLine } from "~test/game-config-validation/support/gameValidationTestSource";
import { createTemporaryMaterialLifecycleTestConfig } from "~test/item-schedule/fx/temporaryMaterialLifecycle.test/createTemporaryMaterialLifecycleTestConfig";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";

const boardFn = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

describe("readItemPhysicalContextFx", () => {
	it("follows nested input and job ownership to the outer grid owner", () => {
		const base = createTemporaryMaterialLifecycleTestConfig();
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				owner: {
					...base.items.owner,
					lines: base.items.owner.lines.map((line) => ({
						...line,
						input: line.input.map((input) =>
							input.type === "materials"
								? {
										...input,
										mode: "reserve" as const,
									}
								: input,
						),
					})),
				},
				temporary: {
					...base.items.temporary,
					lines: [
						createLine({
							id: "buffer",
							input: [
								{
									type: "materials",
									query: {
										distance: "far" as const,
										selector: {
											type: "item",
											itemUid: "residue",
										},
									},
									quantity: {
										min: 1,
										max: 1,
									},
									mode: "consume",
								},
							],
						}),
					],
				},
			},
		});
		const context = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "owner",
					itemUid: "owner",

					location: boardFn(0),
				});
				const material = yield* spawnItemFx({
					id: "material",
					itemUid: "temporary",

					location: boardFn(1),
				});
				const child = yield* spawnItemFx({
					id: "child",
					itemUid: "residue",

					location: boardFn(2),
				});
				yield* bufferInputMaterialForTestFx({
					ownerItemId: material.id,
					lineId: "buffer",
					inputIndex: 0,
					sourceItemId: child.id,
					sourceItemRevision: child.revision,
				});
				const storedMaterial = (yield* readRuntimeFx()).items.find(
					(item) => item.id === material.id,
				);
				if (storedMaterial === undefined)
					return yield* Effect.die(new Error("Missing material."));
				yield* bufferInputMaterialForTestFx({
					ownerItemId: "owner",
					lineId: "line:owner",
					inputIndex: 0,
					sourceItemId: storedMaterial.id,
					sourceItemRevision: storedMaterial.revision,
				});
				yield* startLineFx({
					ownerItemId: "owner",
					lineId: "line:owner",
				});
				const runtime = yield* readRuntimeFx();
				const nestedChild = runtime.items.find((item) => item.id === child.id);
				if (nestedChild === undefined)
					return yield* Effect.die(new Error("Missing child."));
				return yield* readItemPhysicalContextFx({
					item: nestedChild,
					runtime,
				});
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(context).toEqual({
			origin: boardFn(0),
		});
	});
});
