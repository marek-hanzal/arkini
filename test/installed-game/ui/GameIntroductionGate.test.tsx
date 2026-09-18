// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import type { PackageGameEngine } from "~/installed-game/type/Game";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runPromise: (effect: Effect.Effect<unknown>) => Effect.runPromise(effect),
	},
}));

import { GameIntroductionGate } from "~/installed-game/ui/GameIntroductionGate";

it("admits the scene only after Continue completes, and does not repeat the welcome on remount", async () => {
	let acknowledged = false;
	let finishFn: () => void = () => undefined;
	const ready = new Promise<void>((resolveFn) => {
		finishFn = resolveFn;
	});
	const startFn = vi.fn(() =>
		ready.then(() => {
			acknowledged = true;
		}),
	);
	const mountedFn = vi.fn();
	const game = {
		introduction: {
			readFn: () => (acknowledged ? undefined : "# Welcome\n\n**Explore** the world."),
			continueFx: Effect.promise(startFn),
		},
		reportCriticalFailureFn: vi.fn(),
	} as unknown as PackageGameEngine;
	const Scene = () => {
		useEffect(mountedFn, []);
		return <div data-ui="TestScene" />;
	};
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const renderFn = (key: string) =>
		root.render(
			<TranslationTestProvider>
				<GameIntroductionGate
					key={key}
					game={game}
				>
					<Scene />
				</GameIntroductionGate>
			</TranslationTestProvider>,
		);
	try {
		await act(async () => renderFn("first"));
		expect(mountedFn).not.toHaveBeenCalled();
		expect(host.querySelector("h1")?.textContent).toBe("Welcome");
		const button = host.querySelector("button")!;
		await act(async () => button.click());
		expect(startFn).toHaveBeenCalledTimes(1);
		expect(button.disabled).toBe(true);
		expect(mountedFn).not.toHaveBeenCalled();
		await act(async () => {
			finishFn();
			await ready;
		});
		expect(mountedFn).toHaveBeenCalledTimes(1);
		expect(host.querySelector('[data-ui="GameIntroduction"]')).toBeNull();
		await act(async () => renderFn("remounted"));
		expect(host.querySelector('[data-ui="TestScene"]')).not.toBeNull();
		expect(startFn).toHaveBeenCalledTimes(1);
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});
