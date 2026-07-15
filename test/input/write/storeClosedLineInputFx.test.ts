import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { getItemFx } from "~/v1/runtime/read/getItemFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { purityTestConfig } from "~test/line/support/purityTestConfig";

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
				const stored = yield* Effect.either(
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

		expect(Either.isLeft(result.stored)).toBe(true);
		if (Either.isLeft(result.stored)) {
			expect(result.stored.left).toMatchObject({
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
