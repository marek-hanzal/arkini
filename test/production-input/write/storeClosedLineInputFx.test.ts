import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { storeInputMaterialFx } from "~/production-input/write/storeInputMaterialFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { getItemFx } from "~test/support/runtime/getItemFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { purityTestConfig } from "~test/production-line/support/purityTestConfig";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

const prepareFx = Effect.fn("prepareClosedLineInputTestFx")(function* ({
	lineId,
	ownerItemId,
	sourceItemId,
}: {
	lineId: "line:producer:buffer" | "line:producer:zero";
	ownerItemId: string;
	sourceItemId: string;
}) {
	yield* spawnItemFx({
		id: ownerItemId,
		itemId: "producer",
		location: board(0),
		quantity: 1,
	});
	const source = yield* spawnItemFx({
		id: sourceItemId,
		itemId: "material",
		location: board(1),
		quantity: 2,
	});
	yield* storeInputMaterialFx({
		ownerItemId,
		lineId,
		inputIndex: 0,
		sourceItemId,
		sourceItemRevision: source.revision,
		quantity: 1,
	});
	yield* startLineFx({
		ownerItemId,
		lineId,
	});
});

describe("storeInputMaterialFx closed line inputs", () => {
	it("rejects refill of a zero-capacity input while its line runs", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareFx({
					lineId: "line:producer:zero",
					ownerItemId: "runtime:producer",
					sourceItemId: "runtime:material",
				});
				const source = yield* getItemFx({
					itemId: "runtime:material",
				});
				const before = yield* readRuntimeFx();
				const stored = yield* Effect.result(
					storeInputMaterialFx({
						ownerItemId: "runtime:producer",
						lineId: "line:producer:zero",
						inputIndex: 0,
						sourceItemId: source.id,
						sourceItemRevision: source.revision,
						quantity: 1,
					}),
				);
				const after = yield* readRuntimeFx();

				return {
					after,
					before,
					stored,
				};
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(Result.isFailure(result.stored)).toBe(true);
		if (Result.isFailure(result.stored)) {
			expect(result.stored.failure).toMatchObject({
				_tag: "LineInputClosedError",
				ownerItemId: "runtime:producer",
				lineId: "line:producer:zero",
				inputIndex: 0,
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("accepts refill into positive capacity while the line runs", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareFx({
					lineId: "line:producer:buffer",
					ownerItemId: "runtime:producer",
					sourceItemId: "runtime:material",
				});
				const source = yield* getItemFx({
					itemId: "runtime:material",
				});
				const stored = yield* storeInputMaterialFx({
					ownerItemId: "runtime:producer",
					lineId: "line:producer:buffer",
					inputIndex: 0,
					sourceItemId: source.id,
					sourceItemRevision: source.revision,
					quantity: 1,
				});
				const runtime = yield* readRuntimeFx();

				return {
					runtime,
					stored,
				};
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(result.stored.storedItem.location).toMatchObject({
			scope: "input",
			ownerItemId: "runtime:producer",
			lineId: "line:producer:buffer",
			inputIndex: 0,
		});
		expect(
			result.runtime.items
				.filter((item) => item.location.scope === "input")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBe(1);
	});
});
