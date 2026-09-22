import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { getItemFx } from "~test/support/getItemFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { lineSelectionTestConfig } from "~test/production-line/support/lineSelectionTestConfig";

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
	lineId: "line:producer:zero";
	ownerItemId: string;
	sourceItemId: string;
}) {
	yield* spawnItemFx({
		id: ownerItemId,
		itemId: "producer",
		location: board(0),
	});
	const source = yield* spawnItemFx({
		id: `${sourceItemId}:buffered`,
		itemId: "material",
		location: board(1),
	});
	yield* storeInputMaterialFx({
		ownerItemId,
		lineId,
		inputIndex: 0,
		sourceItemId: source.id,
		sourceItemRevision: source.revision,
	});
	yield* spawnItemFx({
		id: sourceItemId,
		itemId: "material",
		location: board(1),
	});

	yield* startLineFx({
		ownerItemId,
		lineId,
	});
});

describe("storeInputMaterialFx closed line inputs", () => {
	it("rejects refill while the line runs", () => {
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
					config: lineSelectionTestConfig,
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
});
