import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { autofillLineInputsFx } from "~test/support/autofillLineInputsFx";
import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import { withdrawLineInputFx } from "~/production-input/fx/withdrawLineInputFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";

const ownerItemId = "runtime:workshop";
const lineUid = "line:workshop:build";
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
								itemUid: "stone",
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
								itemUid: "water",
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
								itemUid: "water",
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
								itemUid: "water",
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
		itemUid: "workshop",
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
		itemUid: "water",
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
					lineUid,
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
					lineUid,
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
					lineUid,
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

	it("withdraws one exact input completely while preserving its buffered sibling", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				for (const [itemUid, count, inputIndex] of [
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
							id: index === 0 ? `runtime:${itemUid}` : `runtime:${itemUid}:${index}`,
							itemUid,
							location: sourceLocation(1),
						});
						yield* bufferInputMaterialForTestFx({
							ownerItemId,
							lineUid,
							inputIndex,
							sourceItemId: item.id,
							sourceItemRevision: item.revision,
						});
					}
				}

				const withdrawn = yield* withdrawLineInputFx({
					ownerItemId,
					lineUid,
					inputIndex: 0,
				});
				const runtime = yield* readRuntimeFx();
				const stale = yield* Effect.exit(
					withdrawLineInputFx({
						ownerItemId,
						lineUid,
						inputIndex: 0,
					}),
				);
				const withdrawnSibling = yield* withdrawLineInputFx({
					ownerItemId,
					lineUid,
					inputIndex: 1,
				});

				return {
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

		expect(result.withdrawn).toEqual({
			withdrawnItemCount: 3,
		});
		expect(result.runtime.items).toContainEqual(
			expect.objectContaining({
				id: "runtime:stone",

				location: {
					scope: "input",
					ownerItemId,
					lineUid,
					inputIndex: 1,
				},
			}),
		);
		expect(result.withdrawnSibling).toEqual({
			withdrawnItemCount: 2,
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

it("rolls back every withdrawn identity and its queue when a later placement fails", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* spawnOwnerFx();
			for (const id of [
				"runtime:water:first",
				"runtime:water:second",
			]) {
				const water = yield* spawnWaterFx({
					id,
					location: sourceLocation(1),
				});
				yield* bufferInputMaterialForTestFx({
					ownerItemId,
					lineUid,
					inputIndex: 0,
					sourceItemId: water.id,
					sourceItemRevision: water.revision,
				});
			}
			// The owner leaves one cell: the first return fits, the second must roll it back.
			yield* enqueueLineFx({
				ownerItemId,
				lineUid,
			});
			const before = yield* readRuntimeFx();
			const withdrawal = yield* Effect.exit(
				withdrawLineInputFx({
					ownerItemId,
					lineUid,
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

	expect(result.before.jobQueue).toHaveLength(1);
	expect(Exit.isFailure(result.withdrawal)).toBe(true);
	if (Exit.isFailure(result.withdrawal)) {
		expect(Option.getOrThrow(Cause.findErrorOption(result.withdrawal.cause))).toMatchObject({
			_tag: "PlacementUnavailableError",
		});
	}
	expect(result.after).toEqual(result.before);
});
