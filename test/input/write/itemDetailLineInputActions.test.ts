import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { settleItemDeliveryFx } from "~/engine/delivery/write/settleItemDeliveryFx";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { withdrawLineInputFx } from "~/engine/input/write/withdrawLineInputFx";
import { withdrawLineInputsFx } from "~/engine/input/write/withdrawLineInputsFx";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import { getItemFx } from "~/engine/runtime/read/getItemFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import {
	inputRuntimeTestConfig,
	inputRuntimeToolbarTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

const ownerItemId = "runtime:workshop";
const lineId = "line:workshop:build";
const inputTestWorkshop = inputRuntimeTestConfig.items.workshop;
if (inputTestWorkshop.type !== "producer") {
	throw new Error("Expected the input runtime test workshop to be a producer.");
}

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
						selector: {
							type: "item",
							itemId: "stone",
						},
						quantity: {
							type: "value",
							value: 2,
						},
						capacity: 0,
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
			width: 1,
			height: 1,
		},
		inventory: {
			width: 1,
			height: 1,
		},
		toolbarSize: 0,
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
						selector: {
							type: "item",
							itemId: "water",
						},
						quantity: {
							type: "range",
							min: 1,
							max: 4,
						},
						capacity: 2,
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
						selector: {
							type: "item",
							itemId: "water",
						},
						quantity: {
							type: "range",
							min: 1,
							max: 4,
						},
					},
					{
						type: "materials",
						selector: {
							type: "item",
							itemId: "water",
						},
						quantity: {
							type: "value",
							value: 2,
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
		quantity: 1,
	});

const spawnWaterFx = ({
	id,
	location,
	quantity,
}: {
	readonly id: string;
	readonly location:
		| ReturnType<typeof sourceLocation>
		| {
				readonly scope: "inventory" | "toolbar";
				readonly position: {
					readonly x: number;
					readonly y: number;
				};
		  };
	readonly quantity: number;
}) =>
	spawnItemFx({
		id,
		itemId: "water",
		location,
		quantity,
	});

describe("Item Detail line input actions", () => {
	it("autofills a range input toward the available maximum without filling its buffer", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx({
					id: "runtime:water",
					location: sourceLocation(1),
					quantity: 7,
				});

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
			],
			remainingMissingQuantity: 0,
			scheduledQuantity: 4,
		});
		expect(result.runtime.items.find((item) => item.id === "runtime:water")).toMatchObject({
			quantity: 7,
			location: {
				scope: "delivery",
				target: {
					input: [
						{
							inputIndex: 0,
							quantity: 4,
						},
					],
				},
			},
		});
	});

	it("satisfies every compatible minimum before topping a range input toward max", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx({
					id: "runtime:water",
					location: sourceLocation(1),
					quantity: 4,
				});

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
		expect(result.runtime.items.find((item) => item.id === "runtime:water")).toMatchObject({
			location: {
				target: {
					input: [
						{
							inputIndex: 0,
							quantity: 2,
						},
						{
							inputIndex: 1,
							quantity: 2,
						},
					],
				},
			},
		});
	});

	it("waits for every useful range top-up delivery before starting the line", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx({
					id: "runtime:minimum",
					location: sourceLocation(1),
					quantity: 1,
				});
				yield* spawnWaterFx({
					id: "runtime:top-up",
					location: sourceLocation(2),
					quantity: 3,
				});
				yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
					purpose: {
						kind: "fill-and-try-start",
						ownerItemId,
						lineId,
					},
				});

				yield* settleItemDeliveryFx({
					itemId: "runtime:minimum",
					generation: 0,
				});
				const afterMinimum = yield* readRuntimeFx();
				yield* settleItemDeliveryFx({
					itemId: "runtime:top-up",
					generation: 0,
				});
				return {
					afterMinimum,
					afterTopUp: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: rangeInputTestConfig,
				}),
			),
		);

		expect(result.afterMinimum.jobs).toHaveLength(0);
		expect(
			result.afterMinimum.items.find((item) => item.id === "runtime:top-up"),
		).toMatchObject({
			location: {
				phase: "outbound",
				scope: "delivery",
			},
		});
		expect(result.afterTopUp.jobs).toHaveLength(1);
		expect(
			result.afterTopUp.items
				.filter((item) => item.location.scope === "job")
				.reduce((total, item) => total + item.quantity, 0),
		).toBe(4);
	});

	it("autofills deterministic board, Toolbar, and Inventory sources in physical priority", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx({
					id: "runtime:near",
					location: sourceLocation(1),
					quantity: 1,
				});
				yield* spawnWaterFx({
					id: "runtime:toolbar",
					location: {
						scope: "toolbar",
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* spawnWaterFx({
					id: "runtime:inventory",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 2,
				});

				const beforeRuntime = yield* readRuntimeFx();
				const before = yield* readItemDetailLinesFx({
					itemId: ownerItemId,
					runtime: beforeRuntime,
				});
				const autofilled = yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				const runtime = yield* readRuntimeFx();
				const after = yield* readItemDetailLinesFx({
					itemId: ownerItemId,
					runtime,
				});

				return {
					after,
					autofilled,
					before,
					runtime,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeToolbarTestConfig,
				}),
			),
		);

		expect(result.before).toMatchObject({
			kind: "available",
			line: [
				{
					actions: {
						immediate: {
							enabled: true,
						},
						canWithdraw: false,
					},
				},
			],
		});
		expect(result.autofilled).toEqual({
			deliveryItemIds: [
				"runtime:near",
				"runtime:toolbar",
				"runtime:inventory",
			],
			remainingMissingQuantity: 0,
			scheduledQuantity: 3,
		});
		const buffered = result.runtime.items.filter(
			(item) =>
				item.location.scope === "input" &&
				item.location.ownerItemId === ownerItemId &&
				item.location.lineId === lineId,
		);
		expect(buffered).toHaveLength(0);
		expect(result.runtime.items.find((item) => item.id === "runtime:inventory")).toMatchObject({
			quantity: 2,
			location: {
				phase: "outbound",
				scope: "delivery",
			},
		});
		expect(result.runtime.items.find((item) => item.id === "runtime:toolbar")).toMatchObject({
			location: {
				phase: "outbound",
				scope: "delivery",
			},
		});
		expect(result.after).toMatchObject({
			kind: "available",
			line: [
				{
					actions: {
						immediate: {
							enabled: false,
						},
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

	it("autofills only the missing quantity without consuming spare input capacity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx({
					id: "runtime:water",
					location: sourceLocation(1),
					quantity: 7,
				});

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
			quantity: 7,
		});
	});

	it("starts only after the physical delivery contact settles", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx({
					id: "runtime:water",
					location: sourceLocation(1),
					quantity: 7,
				});

				yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
					purpose: {
						kind: "fill-and-try-start",
						ownerItemId,
						lineId,
					},
				});
				const started = yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				return {
					started,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.runtime.jobs).toHaveLength(1);
		expect(result.runtime.items.find((item) => item.id === "runtime:water")).toMatchObject({
			location: {
				phase: "returning",
				scope: "delivery",
			},
			quantity: 4,
		});
		expect(result.started).toMatchObject({
			status: "stored",
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
					quantity: 3,
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
						immediate: {
							enabled: false,
						},
						canWithdraw: false,
					},
				},
			],
		});
	});

	it("withdraws required input and excess buffer through canonical placement", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx({
					id: "runtime:required-water",
					location: sourceLocation(1),
					quantity: 3,
				});
				yield* spawnWaterFx({
					id: "runtime:buffered-water",
					location: sourceLocation(2),
					quantity: 2,
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
					quantity: 3,
				});
				const bufferedWater = yield* getItemFx({
					itemId: "runtime:buffered-water",
				});
				yield* storeInputMaterialFx({
					ownerItemId,
					lineId,
					inputIndex: 0,
					sourceItemId: bufferedWater.id,
					sourceItemRevision: bufferedWater.revision,
					quantity: 2,
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
			withdrawnItemCount: 2,
			withdrawnQuantity: 5,
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
				quantity: 5,
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
						immediate: {
							enabled: true,
						},
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

	it("withdraws one exact input completely while preserving its filled sibling", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx({
					id: "runtime:water",
					location: sourceLocation(1),
					quantity: 3,
				});
				yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: sourceLocation(2),
					quantity: 2,
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
					quantity: 3,
				});
				const stone = yield* getItemFx({
					itemId: "runtime:stone",
				});
				yield* storeInputMaterialFx({
					ownerItemId,
					lineId,
					inputIndex: 1,
					sourceItemId: stone.id,
					sourceItemRevision: stone.revision,
					quantity: 2,
				});

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
			withdrawnItemCount: 1,
			withdrawnQuantity: 3,
		});
		expect(result.runtime.items).toContainEqual(
			expect.objectContaining({
				id: "runtime:stone",
				quantity: 2,
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
			withdrawnItemCount: 1,
			withdrawnQuantity: 2,
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

	it("leaves the exact input unchanged when canonical placement fails", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx({
					id: "runtime:water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 3,
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
					quantity: 3,
				});
				yield* spawnItemFx({
					id: "runtime:blocker",
					itemId: "stone",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
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
});
