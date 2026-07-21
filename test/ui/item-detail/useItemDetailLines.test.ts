// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { testGameRead, testGameReadOrThrow } from "~test/support/game/testGameRead";

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
	categories: {},
	items: {
		producer: {
			id: "producer",
			type: "producer",
			title: "Producer",
			description: "Consumes tagged material.",
			asset: {
				source: [
					"asset:producer",
				],
			},
			tags: [],
			categoryId: "building",
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
								type: "tag",
								tag: "fuel",
							},
							quantity: {
								type: "value",
								value: 1,
							},
							capacity: 0,
							mode: "consume",
						},
					],
					rules: [],
				},
			],
		},
		material: {
			id: "material",
			type: "simple",
			title: "Material",
			description: "Eligible fuel.",
			asset: {
				source: [
					"asset:material",
				],
			},
			tags: [
				"fuel",
			],
			categoryId: "resource",
			scope: "board",
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

let currentRuntime: RuntimeSchema.Type = withoutSource;
const listeners = new Set<() => void>();
const publishRuntime = (runtime: RuntimeSchema.Type) => {
	currentRuntime = runtime;
	for (const listener of listeners) listener();
};

const game = {
	arkpack: {
		packageId: "test-package",
		contentHash: "test-hash",
		gameId: config.meta.id,
		title: config.meta.title,
		configVersion: config.version,
		compressedSize: 0,
		source: "imported" as const,
	},
	config,
	saveKey: {
		packageId: "test-package",
		contentHash: "0".repeat(64),
	},
	getSnapshot: () => currentRuntime,
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
	subscribeEvents: () => () => undefined,
	read: testGameRead,
	readOrThrow: testGameReadOrThrow,
	run: (() => Promise.reject(new Error("Not used by this test."))) as GameEngine["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies GameEngine;

const roots: Array<ReturnType<typeof createRoot>> = [];

const Probe = ({ itemId }: { readonly itemId: string }) => {
	const projection = useItemDetailLines(itemId);
	const canAutofill =
		projection.kind === "available" ? projection.line[0]?.actions.canAutofill : undefined;
	return createElement("output", {
		"data-can-autofill": String(canAutofill),
	});
};

beforeEach(() => {
	currentRuntime = withoutSource;
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
		expect(output?.dataset.canAutofill).toBe("false");

		await act(async () => publishRuntime(withSource));
		expect(output?.dataset.canAutofill).toBe("true");

		await act(async () => publishRuntime(withoutSource));
		expect(output?.dataset.canAutofill).toBe("false");
	});
});
