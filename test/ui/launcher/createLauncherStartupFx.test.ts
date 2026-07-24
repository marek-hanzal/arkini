import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { createLauncherStartupFx } from "~/ui/launcher/createLauncherStartupFx";

const catalog: ArkpackCatalog = {
	getSnapshot: () => ({
		type: "loading",
	}),
	refreshFx: Effect.void,
	importFileFx: () => Effect.die("unused"),
	removeFx: () => Effect.die("unused"),
	subscribe: () => () => undefined,
};

describe("createLauncherStartupFx", () => {
	it("runs one authoritative initial bootstrap and records session completion", async () => {
		const bootstrap = vi.fn();
		const startup = Effect.runSync(
			createLauncherStartupFx({
				catalog,
				heroUrl: "hero.png",
				bootstrapFx: Effect.sync(() => {
					bootstrap();
					return {
						appearance: {
							theme: "light" as const,
							accent: "blue" as const,
						},
						builtInPackageId: "built-in",
						cheatsAvailable: true,
					};
				}),
			}),
		);

		await Effect.runPromise(startup.startFx);
		await Effect.runPromise(startup.startFx);
		expect(bootstrap).toHaveBeenCalledOnce();
		expect(startup.getSnapshot()).toEqual({
			type: "ready",
			appearanceReady: false,
			builtInPackageId: "built-in",
			heroReady: true,
			splashCompleted: false,
		});
		const consume = vi.fn();
		expect(startup.consumeHydration(consume)).toBe(true);
		expect(consume).toHaveBeenCalledWith({
			appearance: {
				theme: "light",
				accent: "blue",
			},
			cheatsAvailable: true,
		});
		expect(startup.getSnapshot().appearanceReady).toBe(true);
		expect(startup.consumeHydration(consume)).toBe(false);

		Effect.runSync(startup.completeSplashFx);
		expect(startup.getSnapshot().splashCompleted).toBe(true);
		Effect.runSync(startup.completeSplashFx);
		expect(startup.getSnapshot().splashCompleted).toBe(true);
	});

	it("keeps a failed bootstrap retryable through the same owner", async () => {
		let attempt = 0;
		const failure = new Error("bridge unavailable");
		const startup = Effect.runSync(
			createLauncherStartupFx({
				catalog,
				heroUrl: "hero.png",
				bootstrapFx: Effect.suspend(() => {
					attempt += 1;
					return attempt === 1
						? Effect.fail(failure)
						: Effect.succeed({
								appearance: {
									theme: "dark" as const,
									accent: "rose" as const,
								},
								builtInPackageId: "built-in",
								cheatsAvailable: false,
							});
				}),
			}),
		);

		await expect(Effect.runPromise(startup.startFx)).rejects.toThrow("bridge unavailable");
		expect(startup.getSnapshot()).toMatchObject({
			type: "failed",
			appearanceReady: false,
			heroReady: false,
			splashCompleted: false,
		});
		const failed = startup.getSnapshot();
		if (failed.type !== "failed") throw new Error("Failed startup snapshot missing.");
		expect(failed.error).toBeInstanceOf(Error);
		expect((failed.error as Error).message).toBe(failure.message);

		await Effect.runPromise(startup.retryFx);
		expect(attempt).toBe(2);
		expect(startup.getSnapshot().type).toBe("ready");
	});

	it("publishes a failed HMR handoff instead of leaving the splash loading forever", async () => {
		const failure = new Error("previous launcher shutdown failed");
		const bootstrap = vi.fn();
		const startup = Effect.runSync(
			createLauncherStartupFx({
				awaitPreviousShutdown: Promise.reject(failure),
				catalog,
				heroUrl: "hero.png",
				bootstrapFx: Effect.sync(() => {
					bootstrap();
					return {
						appearance: {
							theme: "dark" as const,
							accent: "rose" as const,
						},
						builtInPackageId: "built-in",
						cheatsAvailable: false,
					};
				}),
			}),
		);

		await expect(Effect.runPromise(startup.startFx)).rejects.toThrow(failure.message);
		expect(bootstrap).not.toHaveBeenCalled();
		expect(startup.getSnapshot()).toMatchObject({
			type: "failed",
			error: expect.objectContaining({
				message: failure.message,
			}),
		});
	});

	it("never requeues consumed startup preferences on a later retry", async () => {
		const startup = Effect.runSync(
			createLauncherStartupFx({
				catalog,
				heroUrl: "hero.png",
				bootstrapFx: Effect.succeed({
					appearance: {
						theme: "light",
						accent: "blue",
					},
					builtInPackageId: "built-in",
					cheatsAvailable: true,
				}),
			}),
		);
		let liveTheme = "dark";
		let liveCheatsAvailable = false;

		await Effect.runPromise(startup.startFx);
		expect(
			startup.consumeHydration(({ appearance, cheatsAvailable }) => {
				if (appearance !== undefined) liveTheme = appearance.theme;
				if (cheatsAvailable !== undefined) liveCheatsAvailable = cheatsAvailable;
			}),
		).toBe(true);
		liveTheme = "dark";
		liveCheatsAvailable = false;

		await Effect.runPromise(startup.retryFx);
		expect(startup.consumeHydration(() => undefined)).toBe(false);
		expect(liveTheme).toBe("dark");
		expect(liveCheatsAvailable).toBe(false);
		expect(startup.getSnapshot().appearanceReady).toBe(true);
	});

	it("interrupts and awaits in-flight bootstrap disposal without late publication", async () => {
		let resolveBootstrap!: (result: {
			readonly appearance: {
				readonly theme: "dark";
				readonly accent: "rose";
			};
			readonly builtInPackageId: string;
			readonly cheatsAvailable: boolean;
		}) => void;
		const bootstrapStarted = vi.fn();
		const bootstrapInterrupted = vi.fn();
		const bootstrapPromise = new Promise<{
			readonly appearance: {
				readonly theme: "dark";
				readonly accent: "rose";
			};
			readonly builtInPackageId: string;
			readonly cheatsAvailable: boolean;
		}>((resolve) => {
			resolveBootstrap = resolve;
		});
		const startup = Effect.runSync(
			createLauncherStartupFx({
				catalog,
				heroUrl: "hero.png",
				bootstrapFx: Effect.promise(() => {
					bootstrapStarted();
					return bootstrapPromise;
				}).pipe(
					Effect.onInterrupt(() =>
						Effect.sync(() => {
							bootstrapInterrupted();
						}),
					),
				),
			}),
		);
		const publication = vi.fn();
		startup.subscribe(publication);
		const start = Effect.runPromise(startup.startFx).catch(() => undefined);
		await vi.waitFor(() => expect(bootstrapStarted).toHaveBeenCalledOnce());

		await Effect.runPromise(startup.disposeFx);
		await start;
		expect(bootstrapInterrupted).toHaveBeenCalledOnce();
		const stateAfterDispose = startup.getSnapshot();
		const publicationsAfterDispose = publication.mock.calls.length;

		resolveBootstrap({
			appearance: {
				theme: "dark",
				accent: "rose",
			},
			builtInPackageId: "late-built-in",
			cheatsAvailable: true,
		});
		await Promise.resolve();
		await Promise.resolve();

		expect(startup.getSnapshot()).toBe(stateAfterDispose);
		expect(publication).toHaveBeenCalledTimes(publicationsAfterDispose);
		await expect(Effect.runPromise(startup.retryFx)).rejects.toThrow(
			"Launcher startup is disposed.",
		);
	});
});
