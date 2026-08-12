import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import type { PlannerAction } from "~/editor/planner/PlannerAction";
import { runPlannerActionFx } from "~/editor/planner/runPlannerActionFx";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { completeLineIntentRuntimeFx } from "~/engine/job/fx/completeLineIntentRuntimeFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";

const baseItem = ({
	id,
	maxStackSize = 1,
	scope = "any",
}: {
	readonly id: string;
	readonly maxStackSize?: number;
	readonly scope?: "any" | "board" | "inventory" | "toolbar";
}) => ({
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	description: id,
	id,
	maxStackSize,
	scope,
	title: id,
	uid: id,
});

const guaranteedOutput = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					drop: [
						{
							itemId,
							quantity: {
								max: 1,
								min: 1,
							},
							rules: [],
						},
					],
					type: "guaranteed" as const,
				},
			],
		},
	],
});

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:planner-action",
		title: "Planner action",
		board: {
			height: 1,
			width: 2,
		},
		inventory: {
			height: 1,
			width: 4,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		blocker: {
			...baseItem({
				id: "blocker",
			}),
			type: "simple",
		},
		forge: {
			...baseItem({
				id: "forge",
			}),
			lines: [
				{
					description: "Run the forge.",
					id: "line:forge:run",
					input: [
						{
							capacity: 3,
							mode: "consume",
							quantity: {
								max: 3,
								min: 3,
							},
							selector: {
								itemId: "water",
								type: "item",
							},
							type: "materials",
						},
						{
							capacity: 1,
							mode: "reserve",
							quantity: {
								max: 1,
								min: 1,
							},
							selector: {
								itemId: "tool",
								type: "item",
							},
							type: "materials",
						},
					],
					output: guaranteedOutput("line-result"),
					rules: [],
					runtimeMs: 1_000,
					title: "Run",
				},
			],
			maxQueueSize: 1,
			type: "producer",
		},
		"line-result": {
			...baseItem({
				id: "line-result",
			}),
			type: "simple",
		},
		water: {
			...baseItem({
				id: "water",
				maxStackSize: 10,
			}),
			type: "simple",
		},
		tool: {
			...baseItem({
				id: "tool",
			}),
			type: "simple",
		},
		source: {
			...baseItem({
				id: "source",
			}),
			merge: [
				{
					action: "consume",
					effect: "replace",
					result: "wrong-merge-result",
					target: {
						itemId: "wrong-target",
						type: "item",
					},
				},
				{
					action: "consume",
					effect: "replace",
					result: "merge-result",
					target: {
						itemId: "target",
						type: "item",
					},
				},
			],
			type: "simple",
		},
		"shadowed-source": {
			...baseItem({
				id: "shadowed-source",
			}),
			merge: [
				{
					action: "consume",
					effect: "replace",
					result: "wrong-merge-result",
					target: {
						itemId: "target",
						type: "item",
					},
				},
				{
					action: "consume",
					effect: "replace",
					result: "merge-result",
					target: {
						itemId: "target",
						type: "item",
					},
				},
			],
			type: "simple",
		},
		target: {
			...baseItem({
				id: "target",
			}),
			type: "simple",
		},
		"wrong-target": {
			...baseItem({
				id: "wrong-target",
			}),
			type: "simple",
		},
		"merge-result": {
			...baseItem({
				id: "merge-result",
			}),
			type: "simple",
		},
		"wrong-merge-result": {
			...baseItem({
				id: "wrong-merge-result",
			}),
			type: "simple",
		},
		"temporary-output": {
			...baseItem({
				id: "temporary-output",
				scope: "board",
			}),
			durationMs: 600,
			output: guaranteedOutput("temporary-result"),
			type: "temporary",
		},
		"temporary-result": {
			...baseItem({
				id: "temporary-result",
				scope: "board",
			}),
			type: "simple",
		},
	},
});

const makeState = (items: StateSchema.Type["items"]) =>
	({
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace: 0,
		items,
		jobQueue: [],
		jobs: [],
	}) satisfies StateSchema.Type;

const hydrateRuntime = (state: StateSchema.Type) =>
	Effect.runSync(
		fromStateFx({
			state,
		}).pipe(Effect.provide(Layer.succeed(GameConfigFx, config))),
	);

const runAction = (action: PlannerAction, runtime: RuntimeSchema.Type) =>
	Effect.runSync(
		runPlannerActionFx({
			action,
			runtime,
		}).pipe(Effect.provide(Layer.succeed(GameConfigFx, config))),
	);

const lineAction = {
	kind: "line",
	lineId: "line:forge:run",
	ownerItemId: "forge",
} as const;

const lineState = ({ includeWater = true }: { readonly includeWater?: boolean } = {}) =>
	makeState([
		{
			id: "runtime:blocker:0",
			itemId: "blocker",
			location: {
				position: {
					x: 0,
					y: 0,
				},
				scope: "board",
				space: 0,
			},
			quantity: 1,
		},
		{
			id: "runtime:blocker:1",
			itemId: "blocker",
			location: {
				position: {
					x: 1,
					y: 0,
				},
				scope: "board",
				space: 0,
			},
			quantity: 1,
		},
		{
			id: "runtime:forge",
			itemId: "forge",
			location: {
				position: {
					x: 0,
					y: 0,
				},
				scope: "inventory",
			},
			quantity: 1,
		},
		...(includeWater
			? [
					{
						id: "runtime:water",
						itemId: "water",
						location: {
							position: {
								x: 1,
								y: 0,
							},
							scope: "inventory" as const,
						},
						quantity: 3,
					},
				]
			: []),
		{
			id: "runtime:tool",
			itemId: "tool",
			location: {
				position: {
					x: 2,
					y: 0,
				},
				scope: "inventory",
			},
			quantity: 1,
		},
	]);

describe("runPlannerActionFx", () => {
	it("runs a line through canonical queue, delivery and completion on a physically full board", () => {
		const runtime = hydrateRuntime(lineState());
		const before = structuredClone(runtime);
		const result = runAction(lineAction, runtime);

		expect(runtime).toEqual(before);
		expect(result.type).toBe("completed");
		if (result.type !== "completed" || result.actor.kind !== "line") return;
		const ownerRuntimeItemId = result.actor.ownerRuntimeItemId;
		expect(result.elapsedMs).toBe(1_000);
		expect(result.runtime.items.find(({ id }) => id === ownerRuntimeItemId)).toMatchObject({
			item: {
				id: "forge",
			},
			location: {
				scope: "board",
				space: 0,
			},
		});
		expect(result.events.map(({ type }) => type)).toEqual(
			expect.arrayContaining([
				GameEventEnumSchema.enum.JobStarted,
				GameEventEnumSchema.enum.JobCompleted,
			]),
		);
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.jobQueue).toEqual([]);
		expect(result.runtime.items.some(({ item }) => item.id === "line-result")).toBe(true);
		expect(
			result.runtime.items.some(
				(item) =>
					item.location.scope === "board" &&
					item.location.space === 0 &&
					item.location.position.x >= config.meta.board.width,
			),
		).toBe(true);
		expect(
			result.runtime.items.reduce(
				(total, item) => total + (item.item.id === "tool" ? item.quantity : 0),
				0,
			),
		).toBe(1);
	});

	it("discards speculative line changes and reports missing materials", () => {
		const runtime = hydrateRuntime(
			lineState({
				includeWater: false,
			}),
		);
		const result = runAction(lineAction, runtime);

		expect(result).toMatchObject({
			type: "blocked",
			blocker: {
				code: "action-rejected",
				attempt: [
					{
						failureTag: "LineMaterialsMissing",
						missingQuantity: 3,
						stage: "autofill",
					},
				],
			},
			runtime,
		});
		expect(result.runtime).toBe(runtime);
		expect(runtime.jobs).toEqual([]);
		expect(runtime.jobQueue).toEqual([]);
		expect(runtime.items.some((item) => item.location.scope === "delivery")).toBe(false);
	});

	it("keeps authored time while the planner policy completes the job immediately", () => {
		const runtime = hydrateRuntime(
			makeState([
				{
					id: "runtime:forge",
					itemId: "forge",
					location: {
						position: {
							x: 0,
							y: 0,
						},
						scope: "board",
						space: 0,
					},
					quantity: 1,
				},
				{
					id: "runtime:blocker",
					itemId: "blocker",
					location: {
						position: {
							x: 1,
							y: 0,
						},
						scope: "board",
						space: 0,
					},
					quantity: 1,
				},
				{
					id: "runtime:water",
					itemId: "water",
					location: {
						position: {
							x: 0,
							y: 0,
						},
						scope: "inventory",
					},
					quantity: 3,
				},
				{
					id: "runtime:tool",
					itemId: "tool",
					location: {
						position: {
							x: 1,
							y: 0,
						},
						scope: "inventory",
					},
					quantity: 1,
				},
			]),
		);
		const result = Effect.runSync(
			completeLineIntentRuntimeFx({
				lineId: lineAction.lineId,
				ownerItemId: lineAction.ownerItemId,
				runtime,
			}).pipe(
				Effect.provide(Layer.succeed(GameConfigFx, config)),
				Effect.provideService(RuntimeFx, {
					read: Effect.succeed(runtime),
				}),
			),
		);

		expect(result).toEqual({
			type: "unsupported",
			reason: "timed-work-not-instant",
			runtimeMs: 1_000,
		});
		expect(runtime.jobs).toEqual([]);
		expect(runtime.jobQueue).toEqual([]);
	});

	it("commits the exact authored merge rule selected by the action", () => {
		const runtime = hydrateRuntime(
			makeState([
				{
					id: "runtime:target",
					itemId: "target",
					location: {
						position: {
							x: 0,
							y: 0,
						},
						scope: "board",
						space: 0,
					},
					quantity: 1,
				},
				{
					id: "runtime:blocker",
					itemId: "blocker",
					location: {
						position: {
							x: 1,
							y: 0,
						},
						scope: "board",
						space: 0,
					},
					quantity: 1,
				},
				{
					id: "runtime:source",
					itemId: "source",
					location: {
						position: {
							x: 0,
							y: 0,
						},
						scope: "inventory",
					},
					quantity: 1,
				},
			]),
		);
		const before = structuredClone(runtime);
		const result = runAction(
			{
				kind: "merge",
				mergeIndex: 1,
				sourceItemId: "source",
				targetItemId: "target",
			},
			runtime,
		);

		expect(runtime).toEqual(before);
		expect(result.type).toBe("completed");
		if (result.type !== "completed" || result.actor.kind !== "merge") return;
		expect(result.elapsedMs).toBe(0);
		expect(result.actor).toEqual({
			kind: "merge",
			sourceRuntimeItemId: "runtime:source",
			targetRuntimeItemId: "runtime:target",
		});
		expect(result.runtime.items.some(({ item }) => item.id === "merge-result")).toBe(true);
		expect(result.runtime.items.some(({ item }) => item.id === "wrong-merge-result")).toBe(
			false,
		);
	});

	it("does not bypass canonical first-match merge precedence", () => {
		const runtime = hydrateRuntime(makeState([]));
		const result = runAction(
			{
				kind: "merge",
				mergeIndex: 1,
				sourceItemId: "shadowed-source",
				targetItemId: "target",
			},
			runtime,
		);

		expect(result).toEqual({
			action: {
				kind: "merge",
				mergeIndex: 1,
				sourceItemId: "shadowed-source",
				targetItemId: "target",
			},
			reason: {
				code: "authored-transition-missing",
			},
			runtime,
			type: "unsupported",
		});
	});

	it("rejects an invalid authored merge index before touching runtime identities", () => {
		const runtime = hydrateRuntime(
			makeState([
				{
					id: "runtime:target",
					itemId: "target",
					location: {
						position: {
							x: 0,
							y: 0,
						},
						scope: "board",
						space: 0,
					},
					quantity: 1,
				},
			]),
		);
		const result = runAction(
			{
				kind: "merge",
				mergeIndex: 99,
				sourceItemId: "source",
				targetItemId: "target",
			},
			runtime,
		);

		expect(result).toEqual({
			action: {
				kind: "merge",
				mergeIndex: 99,
				sourceItemId: "source",
				targetItemId: "target",
			},
			reason: {
				code: "authored-transition-missing",
			},
			runtime,
			type: "unsupported",
		});
	});

	it("expires only the soonest matching temporary identity", () => {
		const runtime = hydrateRuntime(
			makeState([
				{
					id: "runtime:temporary:selected",
					itemId: "temporary-output",
					location: {
						position: {
							x: 0,
							y: 0,
						},
						scope: "board",
						space: 0,
					},
					quantity: 1,
					remainingDurationMs: 200,
				},
				{
					id: "runtime:temporary:later",
					itemId: "temporary-output",
					location: {
						position: {
							x: 1,
							y: 0,
						},
						scope: "board",
						space: 0,
					},
					quantity: 1,
					remainingDurationMs: 500,
				},
			]),
		);
		const before = structuredClone(runtime);
		const result = runAction(
			{
				itemId: "temporary-output",
				kind: "temporary-expiry",
			},
			runtime,
		);

		expect(runtime).toEqual(before);
		expect(result.type).toBe("completed");
		if (result.type !== "completed" || result.actor.kind !== "temporary-expiry") return;
		expect(result.elapsedMs).toBe(200);
		expect(result.actor.itemRuntimeId).toBe("runtime:temporary:selected");
		expect(result.runtime.items.some(({ id }) => id === "runtime:temporary:selected")).toBe(
			false,
		);
		expect(result.runtime.items).toContainEqual(
			expect.objectContaining({
				id: "runtime:temporary:later",
				remainingDurationMs: 500,
			}),
		);
		expect(result.runtime.items.some(({ item }) => item.id === "temporary-result")).toBe(true);
	});

	it("returns the original snapshot when an authored runtime participant is missing", () => {
		const runtime = hydrateRuntime(makeState([]));
		const result = runAction(
			{
				itemId: "temporary-output",
				kind: "temporary-expiry",
			},
			runtime,
		);

		expect(result).toEqual({
			action: {
				itemId: "temporary-output",
				kind: "temporary-expiry",
			},
			blocker: {
				code: "runtime-item-missing",
				itemId: "temporary-output",
				role: "temporary",
			},
			runtime,
			type: "blocked",
		});
		expect(result.runtime).toBe(runtime);
	});
});
