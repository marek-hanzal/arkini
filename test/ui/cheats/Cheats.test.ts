// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { Cheats } from "~/ui/cheats/Cheats";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const sessions: Game[] = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const session of sessions.splice(0)) {
		await Effect.runPromise(session.disposeWithoutSaveFx);
	}
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
				contentHash: "content:cheats",
				gameId: "game:cheats",
				title: "Cheats game",
				configVersion: "1.0",
				compressedSize: 0,
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
		await act(async () => {
			root.render(
				createElement(
					QueryClientProvider,
					{
						client: new QueryClient(),
					},
					createElement(Cheats, {
						game,
						onBack: () => undefined,
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

		await act(async () => instant.click());
		await vi.waitFor(() => expect(session.getSnapshot().cheats.instantGameplay).toBe(true));
		expect(instant.checked).toBe(true);

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
});
