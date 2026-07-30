// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { GameRuntimeAtom } from "~/bridge/runtime/GameRuntimeAtom";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { startFx } from "~/engine/start/write/startFx";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import {
	type TestGameTransitionFields,
	makeTestGameTransitionFieldsFx,
} from "~test/support/game/makeTestGameTransitionFieldsFx";
import { testGameRead } from "~test/support/game/testGameRead";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

interface TestGame {
	readonly game: Game;
	readonly transitions: TestGameTransitionFields;
}

const makeTestGameFx = Effect.fn("makeRuntimeSelectorTestGameFx")(
	(packageId: string, runtime: RuntimeSchema.Type) =>
		Effect.gen(function* () {
			const transitions = yield* makeTestGameTransitionFieldsFx(runtime);
			const game = {
				arkpack: {
					packageId,
					hash: `content:${packageId}`,
					gameId: testArkpackConfig.meta.id,
					title: testArkpackConfig.meta.title,
					game: testArkpackConfig.version,
					trust: {
						type: "external",
						reason: "unsigned",
					} as const,
					source: "imported" as const,
				},
				config: testArkpackConfig,
				saveKey: {
					packageId,
					contentHash: "0".repeat(64),
				},
				...transitions,
				getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
				subscribe: () => () => undefined,
				subscribeEvents: () => () => undefined,
				read: testGameRead,
				run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
				disposeFx: Effect.void,
				disposeWithoutSaveFx: Effect.void,
				flushSaveFx: Effect.void,
			} satisfies Game;

			return {
				game,
				transitions,
			} satisfies TestGame;
		}),
);

const initialRuntime = Effect.runSync(
	startFx().pipe(
		useGameFx({
			config: testArkpackConfig,
		}),
	),
);
const selectCurrentSpace = (runtime: RuntimeSchema.Type) => runtime.currentSpace;
const selectSpaceProjection = (runtime: RuntimeSchema.Type) => ({
	currentSpace: runtime.currentSpace,
});
const sameSpaceProjection = (
	left: ReturnType<typeof selectSpaceProjection>,
	right: ReturnType<typeof selectSpaceProjection>,
) => left.currentSpace === right.currentSpace;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
});

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		defaultIdleTTL: 400,
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

const renderProbe = async (
	registry: AtomRegistry.AtomRegistry,
	element: ReturnType<typeof createElement>,
) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				element,
			),
		);
	});
	return root;
};

describe("useRuntimeSelector", () => {
	it("exposes neither the committed transition nor runtime projection as writable", () => {
		const { game } = Effect.runSync(makeTestGameFx("game:read-only", initialRuntime));

		expect(Atom.isWritable(game.committedTransitionAtom)).toBe(false);
		expect(Atom.isWritable(GameRuntimeAtom(game.committedTransitionAtom))).toBe(false);
	});

	it("retains the exact previous projection reference and skips unrelated rerenders", async () => {
		const { game, transitions } = Effect.runSync(
			makeTestGameFx("game:selector", initialRuntime),
		);
		const registry = makeRegistry();
		const projections: Array<ReturnType<typeof selectSpaceProjection>> = [];
		const Probe = () => {
			const selected = useRuntimeSelector(game, selectSpaceProjection, sameSpaceProjection);
			projections.push(selected);
			return createElement("output", null, selected.currentSpace);
		};
		await renderProbe(registry, createElement(Probe));
		const firstProjection = projections.at(-1);
		const initialRenderCount = projections.length;

		await act(async () => {
			Effect.runSync(
				transitions.publishRuntimeFx({
					...initialRuntime,
					cheats: {
						...initialRuntime.cheats,
						everEnabled: !initialRuntime.cheats.everEnabled,
					},
				}),
			);
			await Promise.resolve();
		});

		expect(projections).toHaveLength(initialRenderCount);
		expect(projections.at(-1)).toBe(firstProjection);

		await act(async () => {
			Effect.runSync(
				transitions.publishRuntimeFx({
					...initialRuntime,
					currentSpace: initialRuntime.currentSpace + 1,
				}),
			);
			await Promise.resolve();
		});

		expect(projections).toHaveLength(initialRenderCount + 1);
		expect(projections.at(-1)).not.toBe(firstProjection);
	});

	it("does not rerender for an event-only transition that preserves runtime identity", async () => {
		const { game, transitions } = Effect.runSync(
			makeTestGameFx("game:event-only", initialRuntime),
		);
		const registry = makeRegistry();
		let renders = 0;
		const Probe = () => {
			const currentSpace = useRuntimeSelector(game, selectCurrentSpace);
			renders += 1;
			return createElement("output", null, currentSpace);
		};
		await renderProbe(registry, createElement(Probe));
		const initialRenderCount = renders;

		await act(async () => {
			Effect.runSync(
				transitions.publishRuntimeFx(initialRuntime, [
					{
						type: "current-space:changed",
						previousSpace: initialRuntime.currentSpace,
						currentSpace: initialRuntime.currentSpace,
					},
				]),
			);
			await Promise.resolve();
		});

		expect(renders).toBe(initialRenderCount);
	});

	it("switches to the replacement Game source and ignores later commits from the old Game", async () => {
		const gameA = Effect.runSync(makeTestGameFx("game:a", initialRuntime));
		const runtimeB = {
			...initialRuntime,
			currentSpace: initialRuntime.currentSpace + 10,
		};
		const gameB = Effect.runSync(makeTestGameFx("game:b", runtimeB));
		const registry = makeRegistry();
		const values: number[] = [];
		const Probe = ({ game }: { readonly game: Game }) => {
			const currentSpace = useRuntimeSelector(game, selectCurrentSpace);
			values.push(currentSpace);
			return createElement("output", null, currentSpace);
		};
		const root = await renderProbe(
			registry,
			createElement(Probe, {
				game: gameA.game,
			}),
		);

		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(Probe, {
						game: gameB.game,
					}),
				),
			);
		});
		expect(values.at(-1)).toBe(runtimeB.currentSpace);
		const renderCountAfterReplacement = values.length;

		await act(async () => {
			Effect.runSync(
				gameA.transitions.publishRuntimeFx({
					...initialRuntime,
					currentSpace: initialRuntime.currentSpace + 1,
				}),
			);
			await Promise.resolve();
		});
		expect(values).toHaveLength(renderCountAfterReplacement);

		await act(async () => {
			Effect.runSync(
				gameB.transitions.publishRuntimeFx({
					...runtimeB,
					currentSpace: runtimeB.currentSpace + 1,
				}),
			);
			await Promise.resolve();
		});
		expect(values.at(-1)).toBe(runtimeB.currentSpace + 1);
	});

	it("owns one SubscriptionRef subscriber under StrictMode and releases it on registry disposal", async () => {
		const { game, transitions } = Effect.runSync(
			makeTestGameFx("game:lifecycle", initialRuntime),
		);
		const registry = makeRegistry();
		const Probe = () =>
			createElement("output", null, useRuntimeSelector(game, selectCurrentSpace));

		await renderProbe(registry, createElement(StrictMode, null, createElement(Probe)));
		await vi.waitFor(() =>
			expect(transitions.committedTransitionRef.pubsub.subscribers.size).toBe(1),
		);

		registry.dispose();

		expect(transitions.committedTransitionRef.pubsub.subscribers.size).toBe(0);
	});
});
