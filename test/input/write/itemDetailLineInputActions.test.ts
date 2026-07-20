import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";
import { withdrawLineInputsFx } from "~/engine/input/write/withdrawLineInputsFx";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

const ownerItemId = "runtime:workshop";
const lineId = "line:workshop:build";

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
				readonly scope: "inventory";
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
	it("autofills the minimum from deterministic eligible grids and exposes live actions", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx({
					id: "runtime:far",
					location: sourceLocation(3),
					quantity: 1,
				});
				yield* spawnWaterFx({
					id: "runtime:near",
					location: sourceLocation(1),
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
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.before).toMatchObject({
			kind: "available",
			line: [
				{
					actions: {
						canAutofill: true,
						canWithdraw: false,
					},
				},
			],
		});
		expect(result.autofilled).toEqual({
			storedQuantity: 3,
			remainingMissingQuantity: 0,
		});
		const buffered = result.runtime.items.filter(
			(item) =>
				item.location.scope === "input" &&
				item.location.ownerItemId === ownerItemId &&
				item.location.lineId === lineId,
		);
		expect(buffered.map((item) => item.id)).toEqual([
			"runtime:far",
			"runtime:near",
			expect.stringMatching(/^runtime:/),
		]);
		expect(buffered.reduce((total, item) => total + item.quantity, 0)).toBe(3);
		expect(result.runtime.items.find((item) => item.id === "runtime:inventory")).toMatchObject({
			quantity: 1,
			location: {
				scope: "inventory",
			},
		});
		expect(result.after).toMatchObject({
			kind: "available",
			line: [
				{
					actions: {
						canAutofill: false,
						canWithdraw: true,
					},
					availability: {
						kind: "ready",
					},
				},
			],
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
			storedQuantity: 0,
			remainingMissingQuantity: 3,
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
						canAutofill: false,
						canWithdraw: false,
					},
				},
			],
		});
	});

	it("withdraws every buffered root through canonical placement without touching active work", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx({
					id: "runtime:water",
					location: sourceLocation(1),
					quantity: 3,
				});
				yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
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
			withdrawnQuantity: 3,
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
				quantity: 3,
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
						canAutofill: true,
						canWithdraw: false,
					},
					availability: {
						kind: "blocked",
						reason: "inputs",
					},
				},
			],
		});
	});
});
