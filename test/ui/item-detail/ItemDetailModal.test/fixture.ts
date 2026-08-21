// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, vi } from "vitest";
import type { GameEngine } from "~/bridge/game/GameEngine";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import type { ItemDetailControl } from "~/ui/item-detail/ItemDetailControl";
import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";
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

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		const current = gameEngineState.game;
		if (current === undefined) throw new Error("Test Game Engine is missing.");
		return current;
	},
}));

export const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:item-detail-modal",
		title: "Item Detail modal",
		board: {
			width: 2,
			height: 2,
		},
		inventory: {
			width: 1,
			height: 1,
		},
		toolbarSize: 1,
	},
	start: {
		currentSpace: 0,
		board: [
			{
				itemId: "workshop",
				space: 0,
				x: 0,
				y: 0,
			},
			{
				itemId: "water",
				space: 0,
				x: 1,
				y: 0,
			},
		],
	},
	items: {
		workshop: {
			uid: "workshop",
			id: "workshop",
			type: "producer",
			title: "Workshop",
			description: "Produces water.",
			asset: {
				default: [
					"asset:workshop",
				],
			},
			scope: "any",
			maxStackSize: 1,
			maxQueueSize: 2,
			lines: [
				{
					id: "line:workshop:water",
					title: "Water",
					description: "Create water.",
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
												itemId: "water",
												quantity: {
													min: 1,
													max: 1,
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
		water: {
			uid: "water",
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water.",
			asset: {
				default: [
					"asset:water",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
	},
});

export const initialRuntime = Effect.runSync(
	startFx().pipe(
		useGameFx({
			config,
		}),
	),
);

export let currentRuntime = initialRuntime;

export const runtimeListeners = new Set<() => void>();

export const transitionAtomFields = Effect.runSync(makeTestGameTransitionFieldsFx(currentRuntime));

export const publishRuntime = (runtime: RuntimeSchema.Type) => {
	currentRuntime = runtime;
	Effect.runSync(transitionAtomFields.publishRuntimeFx(runtime));
	for (const listener of runtimeListeners) listener();
};

export const readOrThrowWithConfig = <Result, Error>(
	effect: Effect.Effect<Result, Error, GameConfigFx>,
): Result => Effect.runSync(effect.pipe(Effect.provideService(GameConfigFx, config)));

export const game = {
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
	getFatalError: () => null,
	getSnapshot: () => currentRuntime,
	committedTransitionAtom: transitionAtomFields.committedTransitionAtom,
	failStop: transitionAtomFields.failStop,
	getTransitionSnapshot: () => ({
		sequence: 0,
		previousRuntime: null,
		runtime: currentRuntime,
		events: [],
	}),
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: (listener: () => void) => {
		runtimeListeners.add(listener);
		return () => runtimeListeners.delete(listener);
	},
	subscribeTransitions: (listener) => {
		void listener({
			sequence: 0,
			previousRuntime: null,
			runtime: currentRuntime,
			events: [],
		});
		return () => undefined;
	},
	subscribeEvents: () => () => undefined,
	subscribeFatalError: () => () => undefined,
	read: testGameRead,
	readOrThrow: readOrThrowWithConfig as GameEngine["readOrThrow"],
	reportCriticalFailure: () => undefined,
	runFx: transitionAtomFields.runFx,
	run: (() => Promise.reject(new Error("Not used by this test."))) as GameEngine["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies GameEngine;

export const roots: Array<ReturnType<typeof createRoot>> = [];

export const openItemDetail = (
	control: ItemDetailControl,
	props: Parameters<ItemDetailControl["openItemDetailFx"]>[0],
) => Effect.runSync(control.openItemDetailFx(props));

export const openItemDefinitionDetail = (
	control: ItemDetailControl,
	props: Parameters<ItemDetailControl["openItemDefinitionDetailFx"]>[0],
) => Effect.runSync(control.openItemDefinitionDetailFx(props));

export const Probe = ({
	onControl,
}: {
	readonly onControl: (control: ItemDetailControl) => void;
}) => {
	const control = useItemDetailControl();
	useEffect(
		() => onControl(control),
		[
			control,
			onControl,
		],
	);
	return null;
};

beforeEach(() => {
	motionTestRuntime.reset();
	currentRuntime = initialRuntime;
	Effect.runSync(transitionAtomFields.resetRuntimeFx(currentRuntime));
	runtimeListeners.clear();
	gameEngineState.game = game;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	gameEngineState.game = undefined;
	vi.restoreAllMocks();
});

export const renderItemDetail = async () => {
	let control: ItemDetailControl | undefined;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				ItemDetailProvider,
				{
					game,
				},
				createElement(Probe, {
					onControl: (next) => {
						control = next;
					},
				}),
				createElement(ItemDetailModal),
			),
		);
	});
	if (control === undefined) throw new Error("Missing Item Detail control.");
	return {
		readControl: () => {
			if (control === undefined) throw new Error("Missing Item Detail control.");
			return control;
		},
	};
};
