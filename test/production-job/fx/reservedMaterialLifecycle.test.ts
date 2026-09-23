import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { useGameFx } from "~test/support/useGameFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { RuntimeStoreFx } from "~/game-runtime/context/RuntimeStoreFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";

const base = (id: string) => ({
	uid: id,

	title: id,
	description: id,
	ui: "default" as const,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
});

const reserveInput = (itemId: string) => ({
	type: "materials" as const,
	query: {
		distance: "far" as const,
		selector: {
			type: "item" as const,
			itemUid: itemId,
		},
	},
	quantity: {
		min: 1,
		max: 1,
	},
	mode: "reserve" as const,
});

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:reserved-material-lifecycle",
		title: "Reserved material lifecycle",
		board: {
			width: 4,
			height: 2,
		},
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		"producer:employer": {
			...base("producer:employer"),

			maxQueueSize: 1,
			lines: [
				{
					id: "line:employer:run",
					title: "Run",
					description: "Reserve one worker.",
					runtimeMs: 200,
					input: [
						reserveInput("producer:worker"),
					],
					rules: [],
				},
			],
		},
		"producer:tool-user": {
			...base("producer:tool-user"),

			maxQueueSize: 1,
			lines: [
				{
					id: "line:tool-user:run",
					title: "Run",
					description: "Reserve one pure tool.",
					runtimeMs: 200,
					input: [
						reserveInput("item:tool"),
					],
					rules: [],
				},
			],
		},
		"producer:worker": {
			...base("producer:worker"),

			units: {
				amount: 2,
			},
			maxQueueSize: 1,
			lines: [
				{
					id: "line:worker:spend",
					title: "Spend",
					description: "Spend one worker unit.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
					rules: [],
				},
				{
					id: "line:worker:reserve",
					title: "Reserve",
					description: "Reserve one payload.",
					runtimeMs: 200,
					input: [
						reserveInput("item:payload"),
					],
					rules: [],
				},
			],
		},
		"item:payload": {
			maxQueueSize: 1,
			lines: [],

			...base("item:payload"),
		},
		"item:tool": {
			maxQueueSize: 1,
			lines: [],

			...base("item:tool"),
		},
		"item:blocker": {
			maxQueueSize: 1,
			lines: [],

			...base("item:blocker"),
		},
	},
});

const board = (x: number, y = 0) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y,
	},
});

const reserveWorkerFx = Effect.fn("reserveWorkerFx")(function* ({
	employerId,
	workerId,
}: {
	employerId: string;
	workerId: string;
}) {
	const runtime = yield* readRuntimeFx();
	const worker = runtime.items.find((item) => item.id === workerId);
	if (worker === undefined) {
		return yield* Effect.die(new Error("Worker is missing."));
	}
	yield* storeInputMaterialFx({
		ownerItemId: employerId,
		lineId: "line:employer:run",
		inputIndex: 0,
		sourceItemId: worker.id,
		sourceItemRevision: worker.revision,
	});
	const started = yield* startLineFx({
		ownerItemId: employerId,
		lineId: "line:employer:run",
	});
	if (started.type !== "started") return yield* Effect.die(new Error("Employer did not start."));
	return started.job;
});

describe("reserved material lifecycle", () => {
	it("returns one partially spent impure item with the same identity and unit state", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const employer = yield* spawnItemFx({
					id: "runtime:employer",
					itemUid: "producer:employer",
					location: board(0),
				});
				const worker = yield* spawnItemFx({
					id: "runtime:worker",
					itemUid: "producer:worker",
					location: board(1),
				});
				yield* startLineFx({
					ownerItemId: worker.id,
					lineId: "line:worker:spend",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const job = yield* reserveWorkerFx({
					employerId: employer.id,
					workerId: worker.id,
				});
				const reserved = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const store = yield* RuntimeStoreFx;
				const transition = yield* store.read;
				return {
					completed: transition.runtime,
					events: transition.events,
					job,
					reserved,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.reserved.items.find((item) => item.id === "runtime:worker")).toMatchObject({
			remainingUnits: 1,
			location: {
				scope: "reserved",
				jobId: result.job.id,
				inputIndex: 0,
			},
		});
		expect(result.completed.items.find((item) => item.id === "runtime:worker")).toMatchObject({
			remainingUnits: 1,
			location: expect.objectContaining({
				scope: "board",
			}),
		});
		const returnedWorker = result.completed.items.find((item) => item.id === "runtime:worker");
		if (returnedWorker === undefined) throw new Error("Expected returned worker.");
		expect(result.events).toContainEqual({
			type: GameEventEnumSchema.enum.ItemPlaced,
			itemId: returnedWorker.id,
			itemUid: "producer:worker",
			originItemId: "runtime:employer",
			previousLocation: {
				scope: "reserved",
				jobId: result.job.id,
				inputIndex: 0,
			},
			location: returnedWorker.location,
		});
	});

	it("preserves one reserved impure owner and its buffered subtree across completion", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const employer = yield* spawnItemFx({
					id: "runtime:employer",
					itemUid: "producer:employer",
					location: board(0),
				});
				const worker = yield* spawnItemFx({
					id: "runtime:worker",
					itemUid: "producer:worker",
					location: board(1),
				});
				const payload = yield* spawnItemFx({
					id: "runtime:payload",
					itemUid: "item:payload",
					location: board(2),
				});
				yield* storeInputMaterialFx({
					ownerItemId: worker.id,
					lineId: "line:worker:reserve",
					inputIndex: 0,
					sourceItemId: payload.id,
					sourceItemRevision: payload.revision,
				});
				const job = yield* reserveWorkerFx({
					employerId: employer.id,
					workerId: worker.id,
				});
				const reserved = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const completed = yield* readRuntimeFx();
				return {
					completed,
					job,
					reserved,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(
			result.reserved.items.find((item) => item.id === "runtime:worker")?.location,
		).toEqual({
			scope: "reserved",
			jobId: result.job.id,
			inputIndex: 0,
		});
		expect(
			result.reserved.items.find((item) => item.id === "runtime:payload")?.location,
		).toMatchObject({
			scope: "input",
			ownerItemId: "runtime:worker",
		});
		expect(
			result.completed.items.find((item) => item.id === "runtime:worker")?.location,
		).toMatchObject({
			scope: "board",
		});
		expect(
			result.completed.items.find((item) => item.id === "runtime:payload")?.location,
		).toMatchObject({
			scope: "input",
			ownerItemId: "runtime:worker",
		});
	});
});

it("keeps the whole completion blocked when an impure reservation has no exclusive cell", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			const employer = yield* spawnItemFx({
				id: "runtime:employer",
				itemUid: "producer:employer",
				location: board(0),
			});
			const worker = yield* spawnItemFx({
				id: "runtime:worker",
				itemUid: "producer:worker",
				location: board(1),
			});
			const payload = yield* spawnItemFx({
				id: "runtime:payload",
				itemUid: "item:payload",
				location: board(2),
			});
			yield* storeInputMaterialFx({
				ownerItemId: worker.id,
				lineId: "line:worker:reserve",
				inputIndex: 0,
				sourceItemId: payload.id,
				sourceItemRevision: payload.revision,
			});
			const job = yield* reserveWorkerFx({
				employerId: employer.id,
				workerId: worker.id,
			});
			for (const [index, location] of [
				board(1),
				board(2),
				board(3),
				board(0, 1),
				board(1, 1),
				board(2, 1),
				board(3, 1),
			].entries()) {
				yield* spawnItemFx({
					id: `runtime:blocker:${index}`,
					itemUid: "item:blocker",
					location,
				});
			}
			yield* runTickRuntimeByFx({
				elapsedMs: 200,
			});
			return {
				job,
				runtime: yield* readRuntimeFx(),
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);

	expect(result.runtime.jobs).toEqual([
		expect.objectContaining({
			id: result.job.id,
			remainingMs: 0,
		}),
	]);
	expect(result.runtime.items.find((item) => item.id === "runtime:worker")?.location).toEqual({
		scope: "reserved",
		jobId: result.job.id,
		inputIndex: 0,
	});
	expect(
		result.runtime.items.find((item) => item.id === "runtime:payload")?.location,
	).toMatchObject({
		scope: "input",
		ownerItemId: "runtime:worker",
	});
});
