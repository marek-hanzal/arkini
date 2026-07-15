import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";

const base = (id: string, scope: "any" | "board" = "board") => ({
	id,
	title: id,
	description: id,
	asset: {
		source: [
			`asset:${id}`,
		],
	},
	tags: [],
	categoryId: "test",
	scope,
	maxStackSize: 1,
});

const reserveInput = (itemId: string) => ({
	type: "materials" as const,
	selector: {
		type: "item" as const,
		itemId,
	},
	quantity: {
		type: "value" as const,
		value: 1,
	},
	capacity: 0,
	mode: "reserve" as const,
});

const config = GameConfigSchema.parse({
	version: "1.0",
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
		inventory: {
			width: 2,
			height: 1,
		},
	},
	start: {},
	categories: {},
	items: {
		"producer:employer": {
			...base("producer:employer"),
			type: "producer",
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
			type: "producer",
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
			...base("producer:worker", "any"),
			type: "producer",
			charges: {
				amount: 2,
			},
			maxQueueSize: 1,
			lines: [
				{
					id: "line:worker:spend",
					title: "Spend",
					description: "Spend one worker charge.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							charges: {
								from: "self",
								cost: 1,
							},
						},
					],
					rules: [],
				},
				{
					id: "line:worker:buffer",
					title: "Buffer",
					description: "Keep one payload buffered.",
					runtimeMs: 200,
					input: [
						{
							...reserveInput("item:payload"),
							capacity: 1,
						},
					],
					rules: [],
				},
			],
		},
		"item:payload": {
			...base("item:payload", "any"),
			type: "simple",
		},
		"item:tool": {
			...base("item:tool", "any"),
			maxStackSize: 10,
			type: "simple",
		},
		"item:blocker": {
			...base("item:blocker", "any"),
			type: "simple",
		},
	},
});

const board = (x: number, y = 0) => ({
	scope: "board" as const,
	position: {
		x,
		y,
	},
});

const inventory = (x: number) => ({
	scope: "inventory" as const,
	position: {
		x,
		y: 0,
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
	if (worker === undefined) return yield* Effect.dieMessage("Worker is missing.");
	yield* storeInputMaterialFx({
		ownerItemId: employerId,
		lineId: "line:employer:run",
		inputIndex: 0,
		sourceItemId: worker.id,
		sourceItemRevision: worker.revision,
		quantity: 1,
	});
	const started = yield* startLineFx({
		ownerItemId: employerId,
		lineId: "line:employer:run",
	});
	if (started.type !== "started") return yield* Effect.dieMessage("Employer did not start.");
	return started.job;
});

describe("reserved material lifecycle", () => {
	it("returns one partially charged impure item with the same identity and charge state", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const employer = yield* spawnItemFx({
					id: "runtime:employer",
					itemId: "producer:employer",
					location: board(0),
					quantity: 1,
				});
				const worker = yield* spawnItemFx({
					id: "runtime:worker",
					itemId: "producer:worker",
					location: board(1),
					quantity: 1,
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

		expect(result.reserved.items.find((item) => item.id === "runtime:worker")).toMatchObject({
			remainingCharges: 1,
			location: {
				scope: "reserved",
				jobId: result.job.id,
			},
		});
		expect(result.completed.items.find((item) => item.id === "runtime:worker")).toMatchObject({
			remainingCharges: 1,
			location: expect.objectContaining({
				scope: "board",
			}),
		});
	});

	it("preserves one reserved impure owner and its buffered subtree across completion", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const employer = yield* spawnItemFx({
					id: "runtime:employer",
					itemId: "producer:employer",
					location: board(0),
					quantity: 1,
				});
				const worker = yield* spawnItemFx({
					id: "runtime:worker",
					itemId: "producer:worker",
					location: board(1),
					quantity: 1,
				});
				const payload = yield* spawnItemFx({
					id: "runtime:payload",
					itemId: "item:payload",
					location: board(2),
					quantity: 1,
				});
				yield* storeInputMaterialFx({
					ownerItemId: worker.id,
					lineId: "line:worker:buffer",
					inputIndex: 0,
					sourceItemId: payload.id,
					sourceItemRevision: payload.revision,
					quantity: 1,
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

	it("normalizes one pure reservation into an existing canonical stack", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const employer = yield* spawnItemFx({
					id: "runtime:tool-user",
					itemId: "producer:tool-user",
					location: board(0),
					quantity: 1,
				});
				const reservedTool = yield* spawnItemFx({
					id: "runtime:tool:reserved",
					itemId: "item:tool",
					location: board(1),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:tool:stack",
					itemId: "item:tool",
					location: board(2),
					quantity: 2,
				});
				yield* storeInputMaterialFx({
					ownerItemId: employer.id,
					lineId: "line:tool-user:run",
					inputIndex: 0,
					sourceItemId: reservedTool.id,
					sourceItemRevision: reservedTool.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: employer.id,
					lineId: "line:tool-user:run",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.items.some((item) => item.id === "runtime:tool:reserved")).toBe(false);
		expect(result.items.find((item) => item.id === "runtime:tool:stack")?.quantity).toBe(3);
	});

	it("keeps the whole completion blocked when an impure reservation has no exclusive cell", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const employer = yield* spawnItemFx({
					id: "runtime:employer",
					itemId: "producer:employer",
					location: board(0),
					quantity: 1,
				});
				const worker = yield* spawnItemFx({
					id: "runtime:worker",
					itemId: "producer:worker",
					location: board(1),
					quantity: 1,
				});
				const payload = yield* spawnItemFx({
					id: "runtime:payload",
					itemId: "item:payload",
					location: board(2),
					quantity: 1,
				});
				yield* storeInputMaterialFx({
					ownerItemId: worker.id,
					lineId: "line:worker:buffer",
					inputIndex: 0,
					sourceItemId: payload.id,
					sourceItemRevision: payload.revision,
					quantity: 1,
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
					inventory(0),
					inventory(1),
				].entries()) {
					yield* spawnItemFx({
						id: `runtime:blocker:${index}`,
						itemId: "item:blocker",
						location,
						quantity: 1,
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
		expect(result.runtime.items.find((item) => item.id === "runtime:worker")?.location).toEqual(
			{
				scope: "reserved",
				jobId: result.job.id,
			},
		);
		expect(
			result.runtime.items.find((item) => item.id === "runtime:payload")?.location,
		).toMatchObject({
			scope: "input",
			ownerItemId: "runtime:worker",
		});
	});
});
