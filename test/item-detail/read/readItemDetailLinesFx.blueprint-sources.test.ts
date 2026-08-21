import { describe } from "vitest";
import {
	Effect,
	expect,
	it,
	readArkiniGameConfigSource,
	readItemDetailLinesFx,
	readRuntimeFx,
	useGameFx,
} from "./readItemDetailLinesFx.test/fixture";

describe("readItemDetailLinesFx / configured blueprint sources", () => {
	it("hides a Well blueprint source line after one unspent Well blueprint exists", async () => {
		const config = await readArkiniGameConfigSource();
		const lines = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* readRuntimeFx();
				return yield* readItemDetailLinesFx({
					itemId: "runtime:library",
					runtime,
				});
			}).pipe(
				useGameFx({
					config,
					state: {
						cheats: {
							enabled: false,
							everEnabled: false,
							instantGameplay: false,
						},
						currentSpace: 0,
						items: [
							{
								id: "runtime:library",
								itemId: "producer:library-t1",
								location: {
									scope: "board",
									space: 0,
									position: {
										x: 0,
										y: 0,
									},
								},
								quantity: 1,
							},
							{
								id: "runtime:well-blueprint",
								itemId: "item:blueprint-well-t1",
								location: {
									scope: "inventory",
									position: {
										x: 0,
										y: 0,
									},
								},
								quantity: 1,
							},
						],
						jobs: [],

						jobQueue: [],
						defaultLineByOwnerItemId: {},
					},
				}),
			),
		);

		expect(lines).toMatchObject({
			kind: "available",
			line: expect.arrayContaining([
				expect.objectContaining({
					lineId: "line:library-t1:blueprint-well-t1",
					availability: {
						kind: "unavailable",
						reason: {
							kind: "downstream-output-max-count",
							intermediateItemId: "item:blueprint-well-t1",
							itemId: "producer:well-t1",
							liveQuantity: 0,
							reservedQuantity: 2,
							maxCount: 1,
						},
					},
				}),
			]),
		});
	});
});
