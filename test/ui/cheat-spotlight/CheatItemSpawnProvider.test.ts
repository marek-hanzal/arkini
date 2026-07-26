// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import type { GameSession } from "~/bridge/game/GameSession";
import type { CheatItemSpawnControl } from "~/ui/cheat-spotlight/CheatItemSpawnContext";
import { CheatItemSpawnProvider } from "~/ui/cheat-spotlight/CheatItemSpawnProvider";
import { useCheatItemSpawn } from "~/ui/cheat-spotlight/useCheatItemSpawn";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];
const sessions: GameSession[] = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	for (const session of sessions.splice(0)) {
		await Effect.runPromise(session.disposeWithoutSaveFx);
	}
	document.body.replaceChildren();
});

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

const makeGame = (
	session: GameSession,
	commandFx: Effect.Effect<unknown, unknown>,
	suffix: string,
): Game => ({
	...session,
	arkpack: {
		packageId: `package:spawn-${suffix}`,
		contentHash: `content:spawn-${suffix}`,
		gameId: `game:spawn-${suffix}`,
		title: `Spawn ${suffix}`,
		configVersion: "1.0",
		compressedSize: 0,
		trust: {
			type: "external",
			reason: "unsigned",
		} as const,
		source: "imported",
	},
	config: createJobTestConfig(),
	saveKey: {
		packageId: `package:spawn-${suffix}`,
		contentHash: suffix.repeat(64).slice(0, 64),
	},
	getResourceUrl: () => "blob:test",
	runFx: ((_effect) => session.runFx(commandFx)) as Game["runFx"],
});

const makePendingCommand = () => {
	const entered = Effect.runSync(Deferred.make<void>());
	const interrupted = Effect.runSync(Deferred.make<void>());
	const commandFx = Deferred.succeed(entered, undefined).pipe(
		Effect.andThen(Effect.never),
		Effect.onInterrupt(() => Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid)),
	);
	return {
		commandFx,
		entered,
		interrupted,
	};
};

const Probe = ({ observe }: { readonly observe: (control: CheatItemSpawnControl) => void }) => {
	const control = useCheatItemSpawn();
	observe(control);
	return null;
};

const renderProvider = ({
	game,
	observe,
	registry,
	root,
}: {
	readonly game: Game;
	readonly observe: (control: CheatItemSpawnControl) => void;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly root: ReturnType<typeof createRoot>;
}) =>
	root.render(
		createElement(
			RegistryContext.Provider,
			{
				value: registry,
			},
			createElement(
				CheatItemSpawnProvider,
				{
					game,
				},
				createElement(Probe, {
					observe,
				}),
			),
		),
	);

describe("CheatItemSpawnProvider lifecycle", () => {
	it("interrupts the actual session command when the Provider unmounts", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		sessions.push(session);
		const pending = makePendingCommand();
		const game = makeGame(session, pending.commandFx, "a");
		const registry = makeRegistry();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		let control: CheatItemSpawnControl | undefined;

		await act(async () => {
			renderProvider({
				game,
				observe: (next) => {
					control = next;
				},
				registry,
				root,
			});
		});
		control?.request("item:test");
		await Effect.runPromise(Deferred.await(pending.entered));

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		await Effect.runPromise(Deferred.await(pending.interrupted));
	});

	it("interrupts the actual session command when its Atom registry is disposed", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		sessions.push(session);
		const pending = makePendingCommand();
		const game = makeGame(session, pending.commandFx, "b");
		const registry = makeRegistry();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		let control: CheatItemSpawnControl | undefined;

		await act(async () => {
			renderProvider({
				game,
				observe: (next) => {
					control = next;
				},
				registry,
				root,
			});
		});
		control?.request("item:test");
		await Effect.runPromise(Deferred.await(pending.entered));

		await act(async () => {
			registry.dispose();
			await Effect.runPromise(Deferred.await(pending.interrupted));
		});
	});

	it("interrupts Game A and exposes a fresh result when the Provider moves to Game B", async () => {
		const firstSession = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const secondSession = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		sessions.push(firstSession, secondSession);
		const first = makePendingCommand();
		const gameA = makeGame(firstSession, first.commandFx, "c");
		const gameB = makeGame(secondSession, Effect.succeed("game-b"), "d");
		const registry = makeRegistry();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		let control: CheatItemSpawnControl | undefined;
		const observe = (next: CheatItemSpawnControl) => {
			control = next;
		};

		await act(async () => {
			renderProvider({
				game: gameA,
				observe,
				registry,
				root,
			});
		});
		control?.request("item:a");
		await Effect.runPromise(Deferred.await(first.entered));

		await act(async () => {
			renderProvider({
				game: gameB,
				observe,
				registry,
				root,
			});
		});
		await Effect.runPromise(Deferred.await(first.interrupted));
		if (control === undefined) throw new Error("Expected Game B spawn control.");
		expect(control.state.kind).toBe("idle");
		control.request("item:b");
		await vi.waitFor(() => {
			if (control === undefined) throw new Error("Expected Game B spawn control.");
			expect(control.state.kind).toBe("success");
		});
	});

	it("admits a second spawn while the first engine command is still running", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		sessions.push(session);
		const bothEntered = Effect.runSync(Deferred.make<void>());
		const releaseBoth = Effect.runSync(Deferred.make<void>());
		let invocation = 0;
		const commandFx = Effect.gen(function* () {
			invocation += 1;
			if (invocation === 2) yield* Deferred.succeed(bothEntered, undefined);
			yield* Deferred.await(releaseBoth);
		});
		const game = makeGame(session, commandFx, "overlap");
		const registry = makeRegistry();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		let control: CheatItemSpawnControl | undefined;

		await act(async () => {
			renderProvider({
				game,
				observe: (next) => {
					control = next;
				},
				registry,
				root,
			});
		});
		if (control === undefined) throw new Error("Expected spawn control.");
		await act(async () => {
			control?.request("item:first");
			control?.request("item:second");
			await Effect.runPromise(Deferred.await(bothEntered));
		});
		expect(invocation).toBe(2);

		await act(async () => {
			await Effect.runPromise(Deferred.succeed(releaseBoth, undefined));
		});
		await vi.waitFor(() => {
			if (control === undefined) throw new Error("Expected spawn control.");
			expect(control.state.kind).toBe("success");
		});
	});
});
