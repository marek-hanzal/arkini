import { describe } from "vitest";
import {
	Effect,
	GameConfigSchema,
	expect,
	it,
	readArkiniGameConfigSource,
	readItemDetailLinesFx,
	readRuntimeFx,
	useGameFx,
} from "./readItemDetailLinesFx.test/fixture";

describe("readItemDetailLinesFx / deposits and configured sources", () => {
	it("sums the real charges of every eligible nearby deposit", async () => {
		const config = await readArkiniGameConfigSource();
		const lines = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* readRuntimeFx();
				return yield* readItemDetailLinesFx({
					itemId: "runtime:lumberjack",
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
								id: "runtime:lumberjack",
								itemId: "producer:lumberjack-t1",
								location: {
									scope: "board",
									space: 0,
									position: {
										x: 1,
										y: 1,
									},
								},
								quantity: 1,
							},
							{
								id: "runtime:tree:full",
								itemId: "item:tree",
								location: {
									scope: "board",
									space: 0,
									position: {
										x: 1,
										y: 0,
									},
								},
								quantity: 1,
							},
							{
								id: "runtime:tree:five",
								itemId: "item:tree",
								location: {
									scope: "board",
									space: 0,
									position: {
										x: 0,
										y: 1,
									},
								},
								quantity: 1,
								remainingCharges: 5,
							},
							{
								id: "runtime:tree:ten",
								itemId: "item:tree",
								location: {
									scope: "board",
									space: 0,
									position: {
										x: 1,
										y: 2,
									},
								},
								quantity: 1,
								remainingCharges: 10,
							},
							{
								id: "runtime:tree:far",
								itemId: "item:tree",
								location: {
									scope: "board",
									space: 0,
									position: {
										x: 12,
										y: 8,
									},
								},
								quantity: 1,
								remainingCharges: 7,
							},
						],
						jobs: [],

						jobQueue: [],
						defaultLineByOwnerItemId: {},
					},
				}),
			),
		);

		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(
			lines.line
				.find((line) => line.lineId === "line:lumberjack-t1:log")
				?.input.find((input) => input.kind === "deposit"),
		).toMatchObject({
			kind: "deposit",
			requiredCharges: 1,
			availableCharges: 33,
			ready: true,
		});
	});
	it("distinguishes a missing deposit target from a present target with insufficient charges", async () => {
		const config = await readArkiniGameConfigSource();
		const lumberjack = config.items["producer:lumberjack-t1"];
		if (lumberjack?.type !== "producer") throw new Error("Missing lumberjack definition.");
		const testConfig = GameConfigSchema.parse({
			...config,
			items: {
				...config.items,
				[lumberjack.id]: {
					...lumberjack,
					lines: lumberjack.lines.map((line) =>
						line.id === "line:lumberjack-t1:log-double-tree"
							? {
									...line,
									input: [
										...line.input,
										...line.input,
									],
								}
							: line,
					),
				},
			},
		});
		const read = (includeDepletedTarget: boolean) =>
			Effect.runSync(
				Effect.gen(function* () {
					const runtime = yield* readRuntimeFx();
					return yield* readItemDetailLinesFx({
						itemId: "runtime:lumberjack",
						runtime,
					});
				}).pipe(
					useGameFx({
						config: testConfig,
						state: {
							cheats: {
								enabled: false,
								everEnabled: false,
								instantGameplay: false,
							},
							currentSpace: 0,
							items: [
								{
									id: "runtime:lumberjack",
									itemId: "producer:lumberjack-t1",
									location: {
										scope: "board",
										space: 0,
										position: {
											x: 1,
											y: 1,
										},
									},
									quantity: 1,
								},
								...(includeDepletedTarget
									? [
											{
												id: "runtime:double-tree",
												itemId: "item:double-tree",
												location: {
													scope: "board" as const,
													space: 0,
													position: {
														x: 1,
														y: 0,
													},
												},
												quantity: 1,
												remainingCharges: 1,
											},
										]
									: []),
							],
							jobs: [],

							jobQueue: [],
							defaultLineByOwnerItemId: {},
						},
					}),
				),
			);
		const missing = read(false);
		const depleted = read(true);
		if (missing.kind !== "available" || depleted.kind !== "available") {
			throw new Error("Expected lumberjack lines.");
		}
		const missingLine = missing.line.find(
			(line) => line.lineId === "line:lumberjack-t1:log-double-tree",
		);
		const depletedLine = depleted.line.find(
			(line) => line.lineId === "line:lumberjack-t1:log-double-tree",
		);

		expect(missingLine).toMatchObject({
			availability: {
				kind: "unavailable",
				reason: {
					kind: "deposit-target-missing",
					distance: "close",
					selector: {
						type: "item",
						itemId: "item:double-tree",
					},
				},
			},
			input: [
				{
					kind: "deposit",
					availableCharges: 0,
					requiredCharges: 2,
					targetItemIds: [],
					ready: false,
				},
			],
		});
		expect(depletedLine).toMatchObject({
			availability: {
				kind: "available",
				readiness: "inputs",
			},
			input: [
				{
					kind: "deposit",
					availableCharges: 1,
					requiredCharges: 2,
					targetItemIds: [
						"runtime:double-tree",
					],
					ready: false,
				},
			],
		});
	});
});
