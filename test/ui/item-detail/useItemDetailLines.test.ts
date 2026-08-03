// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { makeTestGameTransitionFieldsFx } from "~test/support/game/makeTestGameTransitionFieldsFx";
import { testGameRead } from "~test/support/game/testGameRead";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const gameEngineState = vi.hoisted(() => ({
	game: undefined as GameEngine | undefined,
}));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		const current = gameEngineState.game;
		if (current === undefined) throw new Error("Test Game Engine is missing.");
		return current;
	},
}));

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:item-detail-lines-live-actions",
		title: "Item Detail live actions",
		board: {
			width: 2,
			height: 1,
		},
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
		board: [
			{
				itemId: "producer",
				space: 0,
				x: 0,
				y: 0,
			},
		],
	},
	items: {
		producer: {
			uid: "producer",
			id: "producer",
			type: "producer",
			title: "Producer",
			description: "Consumes tagged material.",
			asset: {
				default: [
					"asset:producer",
				],
			},
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				{
					id: "line:producer",
					title: "Produce",
					description: "Produce.",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "item:fuel",
							},
							quantity: {
								type: "value",
								value: 1,
							},
							capacity: 0,
							mode: "consume",
						},
					],
					rules: [
						{
							type: "enable",
							when: [
								{
									type: "exists",
									query: {
										scope: "board",
										distance: "close",
										selector: {
											type: "item",
											itemId: "material",
										},
									},
								},
							],
						},
					],
				},
				{
					id: "line:producer:deposit",
					title: "Deposit work",
					description: "Requires a nearby material target.",
					runtimeMs: 1_000,
					input: [
						{
							type: "deposit",
							query: {
								scope: "board",
								distance: "close",
								selector: {
									type: "item",
									itemId: "material",
								},
							},
							charges: {
								from: "target",
								cost: 1,
							},
						},
					],
					rules: [],
				},
				{
					id: "line:producer:max",
					title: "Limited output",
					description: "Produces one capped material.",
					runtimeMs: 1_000,
					input: [
						{
							type: "simple",
						},
					],
					output: {
						set: [
							{
								roll: [
									{
										type: "guaranteed",
										drop: [
											{
												itemId: "material",
												quantity: {
													type: "value",
													value: 1,
												},
												rules: [],
											},
										],
									},
								],
							},
						],
					},
					rules: [],
				},
			],
		},
		material: {
			uid: "material",
			id: "material",
			type: "simple",
			title: "Material",
			description: "Eligible fuel.",
			asset: {
				default: [
					"asset:material",
				],
			},
			scope: "any",
			maxCount: 1,
			maxStackSize: 10,
		},
	},
});

const withoutSource = Effect.runSync(
	startFx().pipe(
		useGameFx({
			config,
		}),
	),
);
const sourceRuntime = Effect.runSync(
	Effect.gen(function* () {
		yield* startFx();
		yield* spawnItemFx({
			id: "runtime:material",
			itemId: "material",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 0,
				},
			},
			quantity: 1,
		});
		return yield* readRuntimeFx();
	}).pipe(
		useGameFx({
			config,
		}),
	),
);
const sourceItem = sourceRuntime.items.find((item) => item.item.id === "material");
if (sourceItem === undefined) throw new Error("Missing source material.");
const withSource = {
	...withoutSource,
	items: [
		...withoutSource.items,
		sourceItem,
	],
} satisfies RuntimeSchema.Type;
const withTwoSources = {
	...withoutSource,
	items: [
		{
			...sourceItem,
			id: "runtime:material:inventory",
			location: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
		},
		...withoutSource.items,
		sourceItem,
	],
} satisfies RuntimeSchema.Type;

let currentRuntime: RuntimeSchema.Type = withoutSource;
const listeners = new Set<() => void>();
const transitionFields = Effect.runSync(makeTestGameTransitionFieldsFx(currentRuntime));
const publishRuntime = (runtime: RuntimeSchema.Type) => {
	currentRuntime = runtime;
	Effect.runSync(transitionFields.publishRuntimeFx(runtime));
	for (const listener of listeners) listener();
};

const readOrThrowWithConfig = <Result, Error>(
	effect: Effect.Effect<Result, Error, GameConfigFx>,
): Result => Effect.runSync(effect.pipe(Effect.provideService(GameConfigFx, config)));

const game = {
	arkpack: {
		packageId: "test-package",
		hash: "test-hash",
		gameId: config.meta.id,
		title: config.meta.title,
		game: config.version,
		trust: {
			type: "external",
			reason: "unsigned",
		} as const,
		source: "imported" as const,
	},
	config,
	saveKey: {
		packageId: "test-package",
		contentHash: "0".repeat(64),
	},
	...transitionFields,
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
	subscribeEvents: () => () => undefined,
	read: testGameRead,
	readOrThrow: readOrThrowWithConfig as GameEngine["readOrThrow"],
	reportCriticalFailure: () => undefined,
	run: (() => Promise.reject(new Error("Not used by this test."))) as GameEngine["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies GameEngine;

const roots: Array<ReturnType<typeof createRoot>> = [];

const Probe = ({ itemId }: { readonly itemId: string }) => {
	const projection = useItemDetailLines(itemId);
	const line = projection.kind === "available" ? projection.line[0] : undefined;
	const canEnqueue = line?.actions.enqueue.enabled;
	const unavailableReason =
		line?.availability.kind === "unavailable" ? line.availability.reason : undefined;
	const ruleDetail =
		unavailableReason?.kind === "line-disabled" &&
		unavailableReason.cause.kind === "enable-rule"
			? unavailableReason.cause.condition.detail
			: undefined;
	const roll = line?.output[0]?.roll[0];
	const outputItem = roll?.kind === "guaranteed" ? roll.item[0] : undefined;
	return createElement("output", {
		"data-can-enqueue": String(canEnqueue),
		"data-focus-line": projection.kind === "available" ? (projection.focusLineId ?? "") : "",
		"data-disabled-message": unavailableReason?.message ?? "",
		"data-disabled-rule":
			unavailableReason?.kind === "line-disabled" ? unavailableReason.cause.kind : "",
		"data-disabled-rule-detail": ruleDetail?.itemId ?? "",
		"data-disabled-rule-before":
			unavailableReason?.kind === "line-disabled"
				? unavailableReason.messageBeforeDetail
				: "",
		"data-disabled-rule-after":
			unavailableReason?.kind === "line-disabled" ? unavailableReason.messageAfterDetail : "",
		"data-output-has-runtime-target": String(
			outputItem !== undefined && Object.hasOwn(outputItem, "detailItemId"),
		),
	});
};

const DepositProbe = ({ itemId }: { readonly itemId: string }) => {
	const projection = useItemDetailLines(itemId);
	const line =
		projection.kind === "available"
			? projection.line.find((candidate) => candidate.lineId === "line:producer:deposit")
			: undefined;
	const input = line?.input.find((candidate) => candidate.kind === "deposit");
	const reason = line?.availability.kind === "unavailable" ? line.availability.reason : undefined;
	return createElement("output", {
		"data-available-charges": input?.kind === "deposit" ? input.availableChargesLabel : "",
		"data-detail-item": reason?.kind === "deposit-target-missing" ? reason.detail?.itemId : "",
		"data-detail-source":
			reason?.kind === "deposit-target-missing" ? reason.detail?.sourceUrl : "",
		"data-message-before":
			reason?.kind === "deposit-target-missing" ? reason.messageBeforeDetail : "",
		"data-message-after":
			reason?.kind === "deposit-target-missing" ? reason.messageAfterDetail : "",
		"data-message": reason?.message ?? "",
		"data-reason": reason?.kind ?? "",
	});
};

const MaxCountProbe = ({ itemId }: { readonly itemId: string }) => {
	const projection = useItemDetailLines(itemId);
	const line =
		projection.kind === "available"
			? projection.line.find((candidate) => candidate.lineId === "line:producer:max")
			: undefined;
	const reason = line?.availability.kind === "unavailable" ? line.availability.reason : undefined;
	return createElement("output", {
		"data-message": reason?.message ?? "",
		"data-message-after-title":
			reason?.kind === "direct-output-max-count" ? reason.messageAfterTitle : "",
		"data-reserved":
			reason?.kind === "direct-output-max-count" ? String(reason.reservedQuantity) : "",
	});
};

beforeEach(() => {
	currentRuntime = withoutSource;
	Effect.runSync(transitionFields.resetRuntimeFx(currentRuntime));
	listeners.clear();
	gameEngineState.game = game;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	gameEngineState.game = undefined;
});

describe("useItemDetailLines", () => {
	it("publishes the authoritative active-before-FIFO focus target", async () => {
		const owner = withoutSource.items.find((item) => item.item.id === "producer");
		if (owner === undefined) throw new Error("Missing producer.");
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(Probe, {
					itemId: owner.id,
				}),
			);
		});
		const output = container.querySelector("output");
		expect(output?.dataset.focusLine).toBe("");

		await act(async () =>
			publishRuntime({
				...withoutSource,
				jobQueue: [
					{
						id: "queue:deposit",
						ownerItemId: owner.id,
						lineId: "line:producer:deposit",
					},
				],
			}),
		);
		expect(output?.dataset.focusLine).toBe("line:producer:deposit");

		await act(async () =>
			publishRuntime({
				...withoutSource,
				jobs: [
					{
						id: "job:producer",
						ownerItemId: owner.id,
						lineId: "line:producer",
						durationMs: 1_000,
						remainingMs: 500,
					},
				],
				jobQueue: [
					{
						id: "queue:deposit",
						ownerItemId: owner.id,
						lineId: "line:producer:deposit",
					},
				],
			}),
		);
		expect(output?.dataset.focusLine).toBe("line:producer");
	});

	it("publishes Autofill availability when eligible sources appear and disappear", async () => {
		const owner = withoutSource.items.find((item) => item.item.id === "producer");
		if (owner === undefined) throw new Error("Missing producer.");
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(Probe, {
					itemId: owner.id,
				}),
			);
		});
		const output = container.querySelector("output");
		expect(output?.dataset.canEnqueue).toBe("false");
		expect(output?.dataset.disabledMessage).toBe("Requires Material (Board · close).");
		expect(output?.dataset.disabledRule).toBe("enable-rule");
		expect(output?.dataset.disabledRuleDetail).toBe("material");
		expect(output?.dataset.disabledRuleBefore).toBe("Requires ");
		expect(output?.dataset.disabledRuleAfter).toBe(" · Board · close.");
		expect(output?.dataset.outputHasRuntimeTarget).toBe("false");

		await act(async () => publishRuntime(withSource));
		expect(output?.dataset.canEnqueue).toBe("true");
		expect(output?.dataset.disabledMessage).toBe("");
		expect(output?.dataset.outputHasRuntimeTarget).toBe("false");

		await act(async () => publishRuntime(withTwoSources));
		expect(output?.dataset.outputHasRuntimeTarget).toBe("false");

		await act(async () => publishRuntime(withoutSource));
		expect(output?.dataset.canEnqueue).toBe("false");
		expect(output?.dataset.outputHasRuntimeTarget).toBe("false");
	});

	it("projects a missing deposit target as None with artwork/detail and clears it when present", async () => {
		const owner = withoutSource.items.find((item) => item.item.id === "producer");
		if (owner === undefined) throw new Error("Missing producer.");
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(DepositProbe, {
					itemId: owner.id,
				}),
			);
		});
		const output = container.querySelector("output");
		expect(output?.dataset.reason).toBe("deposit-target-missing");
		expect(output?.dataset.availableCharges).toBe("None");
		expect(output?.dataset.detailItem).toBe("material");
		expect(output?.dataset.detailSource).toBe("resource:asset:material");
		expect(output?.dataset.messageBefore).toBe("Requires ");
		expect(output?.dataset.messageAfter).toBe(" · None available (Board · close).");
		expect(output?.dataset.message).toBe("Requires Material · None available (Board · close).");

		await act(async () => publishRuntime(withSource));
		expect(output?.dataset.reason).toBe("");
		expect(output?.dataset.availableCharges).toBe("0");
	});

	it("keeps candidate reservations conservative while displaying only the live maxCount", async () => {
		const owner = withoutSource.items.find((item) => item.item.id === "producer");
		if (owner === undefined) throw new Error("Missing producer.");
		currentRuntime = withSource;
		Effect.runSync(transitionFields.resetRuntimeFx(currentRuntime));
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(MaxCountProbe, {
					itemId: owner.id,
				}),
			);
		});
		const output = container.querySelector("output");
		expect(output?.dataset.message).toBe("Material limit reached (1/1).");
		expect(output?.dataset.messageAfterTitle).toBe("limit reached (1/1).");
		expect(output?.dataset.reserved).toBe("1");

		await act(async () =>
			publishRuntime({
				...withoutSource,
				jobs: [
					{
						id: "job:material-reservation",
						ownerItemId: owner.id,
						lineId: "line:producer:max",
						durationMs: 1_000,
						remainingMs: 500,
					},
				],
			}),
		);
		expect(output?.dataset.message).toBe("Material would exceed limit (0/1 currently).");
		expect(output?.dataset.messageAfterTitle).toBe("would exceed limit (0/1 currently).");
		expect(output?.dataset.reserved).toBe("2");
	});
});
