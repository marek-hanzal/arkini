import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { autofillLineInputsFx } from "~test/support/autofillLineInputsFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { withdrawLineInputFx } from "~/production-input/fx/withdrawLineInputFx";
import { withdrawLineInputsFx } from "~/production-input/fx/withdrawLineInputsFx";
import { readItemDetailLinesFx } from "~/item-line-detail/fx/readItemDetailLinesFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { getItemFx } from "~test/support/getItemFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";

const ownerItemId = "runtime:workshop";
const lineId = "line:workshop:build";
const inputTestWorkshop = inputRuntimeTestConfig.items.workshop;

const twoInputTestConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	items: {
		...inputRuntimeTestConfig.items,
		workshop: {
			...inputTestWorkshop,
			lines: inputTestWorkshop.lines.map((line) => ({
				...line,
				input: [
					line.input[0],
					{
						type: "materials",
						query: {
							distance: "far" as const,
							selector: {
								type: "item",
								itemId: "stone",
							},
						},
						quantity: {
							min: 2,
							max: 2,
						},
					},
					...line.input.slice(1),
				],
			})),
		},
	},
});
const blockedPlacementTestConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	meta: {
		...inputRuntimeTestConfig.meta,
		board: {
			width: 2,
			height: 1,
		},
	},
});
const rangeInputTestConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	items: {
		...inputRuntimeTestConfig.items,
		workshop: {
			...inputTestWorkshop,
			lines: inputTestWorkshop.lines.map((line) => ({
				...line,
				input: [
					{
						type: "materials",
						query: {
							distance: "far" as const,
							selector: {
								type: "item",
								itemId: "water",
							},
						},
						quantity: {
							min: 1,
							max: 4,
						},
					},
					...line.input.slice(1),
				],
			})),
		},
	},
});
const competingRangeInputTestConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	items: {
		...inputRuntimeTestConfig.items,
		workshop: {
			...inputTestWorkshop,
			lines: inputTestWorkshop.lines.map((line) => ({
				...line,
				input: [
					{
						type: "materials",
						query: {
							distance: "far" as const,
							selector: {
								type: "item",
								itemId: "water",
							},
						},
						quantity: {
							min: 1,
							max: 4,
						},
					},
					{
						type: "materials",
						query: {
							distance: "far" as const,
							selector: {
								type: "item",
								itemId: "water",
							},
						},
						quantity: {
							min: 2,
							max: 2,
						},
					},
					...line.input.slice(1),
				],
			})),
		},
	},
});

const spawnOwnerFx = () =>
	spawnItemFx({
		id: ownerItemId,
		itemId: "workshop",
		location: workshopLocation,
	});

const spawnWaterFx = ({
	id,
	location,
}: {
	readonly id: string;
	readonly location: ReturnType<typeof sourceLocation>;
}) =>
	spawnItemFx({
		id,
		itemId: "water",
		location,
	});

const spawnFourWaterFx = () =>
	Effect.forEach(
		[
			1,
			2,
			3,
			4,
		],
		(x) =>
			spawnWaterFx({
				id: x === 1 ? "runtime:water" : `runtime:water:${x}`,
				location: sourceLocation(x),
			}),
	);

describe("Item Detail line input actions", () => {
	it("autofills a range input toward its maximum", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnFourWaterFx();

				const autofilled = yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				return {
					autofilled,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: rangeInputTestConfig,
				}),
			),
		);

		expect(result.autofilled).toEqual({
			deliveryItemIds: [
				"runtime:water",
				"runtime:water:2",
				"runtime:water:3",
				"runtime:water:4",
			],
			remainingMissingQuantity: 0,
			scheduledQuantity: 4,
		});
		expect(result.runtime.items.find((item) => item.id === "runtime:water")).toMatchObject({
			location: {
				scope: "delivery",
				target: {
					inputIndex: 0,
				},
			},
		});
	});

	it("satisfies every compatible minimum before topping a range input toward max", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnFourWaterFx();

				const autofilled = yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				return {
					autofilled,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: competingRangeInputTestConfig,
				}),
			),
		);

		expect(result.autofilled).toMatchObject({
			remainingMissingQuantity: 0,
			scheduledQuantity: 4,
		});
		for (const inputIndex of [
			0,
			1,
		])
			expect(
				result.runtime.items.filter(
					(item) =>
						item.location.scope === "delivery" &&
						item.location.phase === "outbound" &&
						item.location.target.kind === "line-input" &&
						item.location.target.inputIndex === inputIndex,
				),
			).toHaveLength(2);
	});

	it("autofills only the missing quantity without consuming spare input capacity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnFourWaterFx();

				const autofilled = yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				return {
					autofilled,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.autofilled).toEqual({
			deliveryItemIds: [
				"runtime:water",
				"runtime:water:2",
				"runtime:water:3",
			],
			remainingMissingQuantity: 0,
			scheduledQuantity: 3,
		});
		expect(result.runtime.items.find((item) => item.id === "runtime:water")).toMatchObject({
			location: {
				origin: sourceLocation(1),
				phase: "outbound",
				scope: "delivery",
			},
		});
	});

	it("does not autofill from another board space", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnItemFx({
					id: "runtime:other-space",
					itemId: "water",
					location: {
						scope: "board",
						space: 1,
						position: {
							x: 1,
							y: 0,
						},
					},
				});

				const autofilled = yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				const runtime = yield* readRuntimeFx();
				const lines = yield* readItemDetailLinesFx({
					itemId: ownerItemId,
					runtime,
				});
				return {
					autofilled,
					lines,
					runtime,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.autofilled).toEqual({
			deliveryItemIds: [],
			remainingMissingQuantity: 3,
			scheduledQuantity: 0,
		});
		expect(result.runtime.items).toContainEqual(
			expect.objectContaining({
				id: "runtime:other-space",
				location: expect.objectContaining({
					scope: "board",
					space: 1,
				}),
			}),
		);
		expect(result.lines).toMatchObject({
			kind: "available",
			line: [
				{
					actions: {
						canWithdraw: false,
					},
				},
			],
		});
	});

	it("withdraws stored input through canonical placement", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx({
					id: "runtime:required-water",
					location: sourceLocation(1),
				});
				const requiredWater = yield* getItemFx({
					itemId: "runtime:required-water",
				});
				yield* storeInputMaterialFx({
					ownerItemId,
					lineId,
					inputIndex: 0,
					sourceItemId: requiredWater.id,
					sourceItemRevision: requiredWater.revision,
				});
				const withdrawn = yield* withdrawLineInputsFx({
					ownerItemId,
					lineId,
				});
				const runtime = yield* readRuntimeFx();
				const lines = yield* readItemDetailLinesFx({
					itemId: ownerItemId,
					runtime,
				});
				return {
					lines,
					runtime,
					withdrawn,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.withdrawn).toEqual({
			withdrawnItemCount: 1,
		});
		expect(result.runtime.items).not.toContainEqual(
			expect.objectContaining({
				location: expect.objectContaining({
					scope: "input",
					ownerItemId,
					lineId,
				}),
			}),
		);
		expect(result.runtime.items).toContainEqual(
			expect.objectContaining({
				item: expect.objectContaining({
					id: "water",
				}),

				location: expect.objectContaining({
					scope: "board",
					space: 0,
				}),
			}),
		);
		expect(result.lines).toMatchObject({
			kind: "available",
			line: [
				{
					actions: {
						canWithdraw: false,
					},
					availability: {
						kind: "available",
						readiness: "inputs",
					},
				},
			],
		});
	});

	it("withdraws one exact input completely while preserving its buffered sibling", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				for (const [itemId, count, inputIndex] of [
					[
						"water",
						3,
						0,
					],
					[
						"stone",
						2,
						1,
					],
				] as const) {
					for (let index = 0; index < count; index++) {
						const item = yield* spawnItemFx({
							id: index === 0 ? `runtime:${itemId}` : `runtime:${itemId}:${index}`,
							itemId,
							location: sourceLocation(1),
						});
						yield* storeInputMaterialFx({
							ownerItemId,
							lineId,
							inputIndex,
							sourceItemId: item.id,
							sourceItemRevision: item.revision,
						});
					}
				}

				const before = yield* readItemDetailLinesFx({
					itemId: ownerItemId,
					runtime: yield* readRuntimeFx(),
				});
				const withdrawn = yield* withdrawLineInputFx({
					ownerItemId,
					lineId,
					inputIndex: 0,
				});
				const runtime = yield* readRuntimeFx();
				const after = yield* readItemDetailLinesFx({
					itemId: ownerItemId,
					runtime,
				});
				const stale = yield* Effect.exit(
					withdrawLineInputFx({
						ownerItemId,
						lineId,
						inputIndex: 0,
					}),
				);
				const withdrawnSibling = yield* withdrawLineInputFx({
					ownerItemId,
					lineId,
					inputIndex: 1,
				});
				const afterBoth = yield* readItemDetailLinesFx({
					itemId: ownerItemId,
					runtime: yield* readRuntimeFx(),
				});

				return {
					after,
					afterBoth,
					before,
					runtime,
					stale,
					withdrawn,
					withdrawnSibling,
				};
			}).pipe(
				useGameFx({
					config: twoInputTestConfig,
				}),
			),
		);

		expect(result.before).toMatchObject({
			kind: "available",
			line: [
				{
					input: [
						{
							inputIndex: 0,
							storedQuantity: 3,
							canWithdraw: true,
						},
						{
							inputIndex: 1,
							storedQuantity: 2,
							canWithdraw: true,
						},
					],
				},
			],
		});
		expect(result.withdrawn).toEqual({
			withdrawnItemCount: 3,
		});
		expect(result.runtime.items).toContainEqual(
			expect.objectContaining({
				id: "runtime:stone",

				location: {
					scope: "input",
					ownerItemId,
					lineId,
					inputIndex: 1,
				},
			}),
		);
		expect(result.after).toMatchObject({
			kind: "available",
			line: [
				{
					input: [
						{
							inputIndex: 0,
							storedQuantity: 0,
							canWithdraw: false,
						},
						{
							inputIndex: 1,
							storedQuantity: 2,
							canWithdraw: true,
						},
					],
				},
			],
		});
		expect(result.withdrawnSibling).toEqual({
			withdrawnItemCount: 2,
		});
		expect(result.afterBoth).toMatchObject({
			kind: "available",
			line: [
				{
					input: [
						{
							inputIndex: 0,
							storedQuantity: 0,
							canWithdraw: false,
						},
						{
							inputIndex: 1,
							storedQuantity: 0,
							canWithdraw: false,
						},
					],
				},
			],
		});
		expect(Exit.isFailure(result.stale)).toBe(true);
		if (Exit.isFailure(result.stale)) {
			expect(Option.getOrThrow(Cause.findErrorOption(result.stale.cause))).toMatchObject({
				_tag: "LineInputEmptyError",
				inputIndex: 0,
			});
		}
	});
});

it("leaves the exact input and its queue unchanged when canonical placement fails", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* spawnOwnerFx();
			yield* spawnWaterFx({
				id: "runtime:water",
				location: {
					scope: "board" as const,
					space: 0,
					position: {
						x: 1,
						y: 0,
					},
				},
			});
			const water = yield* getItemFx({
				itemId: "runtime:water",
			});
			yield* storeInputMaterialFx({
				ownerItemId,
				lineId,
				inputIndex: 0,
				sourceItemId: water.id,
				sourceItemRevision: water.revision,
			});
			yield* spawnItemFx({
				id: "runtime:blocker",
				itemId: "stone",
				location: sourceLocation(1),
			});
			yield* enqueueLineFx({
				ownerItemId,
				lineId,
			});
			const before = yield* readRuntimeFx();
			const withdrawal = yield* Effect.exit(
				withdrawLineInputFx({
					ownerItemId,
					lineId,
					inputIndex: 0,
				}),
			);
			return {
				after: yield* readRuntimeFx(),
				before,
				withdrawal,
			};
		}).pipe(
			useGameFx({
				config: blockedPlacementTestConfig,
			}),
		),
	);

	expect(Exit.isFailure(result.withdrawal)).toBe(true);
	expect(result.after).toEqual(result.before);
});
