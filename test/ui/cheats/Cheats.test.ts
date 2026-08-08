// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { Cheats } from "~/ui/cheats/Cheats";
import { useCheatsModel } from "~/ui/cheats/useCheatsModel";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const sessions: Game[] = [];
const registries: AtomRegistry.AtomRegistry[] = [];

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

const CheatsHarness = ({
	game,
	onExit = () => undefined,
}: {
	readonly game: Game;
	readonly onExit?: (admitted: boolean) => void;
}) => {
	const model = useCheatsModel(game);
	return createElement(Cheats, {
		model,
		onBack: () =>
			model.requestExit(
				Effect.sync(() => {
					onExit(true);
				}),
			),
	});
};

const CheatsAdmissionHarness = ({
	game,
	onExit,
}: {
	readonly game: Game;
	readonly onExit: (admitted: boolean) => void;
}) => {
	const model = useCheatsModel(game);
	return createElement(
		"button",
		{
			type: "button",
			onClick: () => {
				model.setEnabled(true);
				model.requestExit(
					Effect.sync(() => {
						onExit(true);
					}),
				);
			},
		},
		"Mutate and exit",
	);
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const session of sessions.splice(0)) {
		await Effect.runPromise(session.disposeWithoutSaveFx);
	}
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
});

describe("Cheats", () => {
	it("renders and mutates the authoritative save-scoped Instant gameplay option", async () => {
		const config = createJobTestConfig();
		const session = await createTestGameSession({
			config,
			tickIntervalMs: 60_000,
		});
		const game: Game = {
			...session,
			arkpack: {
				packageId: "package:cheats",
				hash: "content:cheats",
				gameId: "game:cheats",
				title: "Cheats game",
				game: "1.0",
				trust: {
					type: "external",
					reason: "unsigned",
				} as const,
				source: "imported",
			},
			config,
			getResourceUrl: () => "blob:test",
			saveKey: {
				packageId: "package:cheats",
				contentHash: "c".repeat(64),
			},
		};
		sessions.push(game);
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const registry = makeRegistry();
		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(CheatsHarness, {
						game,
					}),
				),
			);
		});

		const enable = container.querySelector<HTMLInputElement>(
			'[data-ui="CheatsEnabledForGame"] input',
		);
		const instant = container.querySelector<HTMLInputElement>(
			'[data-ui="CheatsInstantGameplay"] input',
		);
		if (enable === null || instant === null) throw new Error("Expected Cheat toggles.");
		expect(enable.checked).toBe(false);
		expect(instant.disabled).toBe(true);

		await act(async () => enable.click());
		await vi.waitFor(() => expect(session.getSnapshot().cheats.enabled).toBe(true));
		expect(session.getSnapshot().cheats.everEnabled).toBe(true);
		expect(instant.disabled).toBe(false);
		expect(container.textContent).toContain("Cheat mode saved.");

		await act(async () => instant.click());
		await vi.waitFor(() => expect(session.getSnapshot().cheats.instantGameplay).toBe(true));
		expect(instant.checked).toBe(true);
		expect(container.textContent).toContain("Instant gameplay saved.");

		await act(async () => enable.click());
		await vi.waitFor(() => expect(session.getSnapshot().cheats.enabled).toBe(false));
		expect(session.getSnapshot().cheats).toEqual({
			enabled: false,
			everEnabled: true,
			instantGameplay: true,
		});
		expect(instant.checked).toBe(true);
		expect(instant.disabled).toBe(true);
	});

	it("blocks same-tick Back admission after a Cheat command claims the surface", async () => {
		const config = createJobTestConfig();
		const session = await createTestGameSession({
			config,
			tickIntervalMs: 60_000,
		});
		const game: Game = {
			...session,
			arkpack: {
				packageId: "package:cheats-race",
				hash: "content:cheats-race",
				gameId: "game:cheats-race",
				title: "Cheats race game",
				game: "1.0",
				trust: {
					type: "external",
					reason: "unsigned",
				} as const,
				source: "imported",
			},
			config,
			getResourceUrl: () => "blob:test",
			saveKey: {
				packageId: "package:cheats-race",
				contentHash: "d".repeat(64),
			},
		};
		sessions.push(game);
		const onExit = vi.fn();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const registry = makeRegistry();
		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(CheatsAdmissionHarness, {
						game,
						onExit,
					}),
				),
			);
		});
		const command = container.querySelector<HTMLButtonElement>("button");
		if (command === null) throw new Error("Expected Cheats admission control.");

		await act(async () => command.click());

		expect(onExit).not.toHaveBeenCalled();
	});
});
