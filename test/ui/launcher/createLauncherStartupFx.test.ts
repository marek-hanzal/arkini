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
					};
				}),
			}),
		);

		await Effect.runPromise(startup.startFx);
		await Effect.runPromise(startup.startFx);
		expect(bootstrap).toHaveBeenCalledOnce();
		expect(startup.getSnapshot()).toEqual({
			type: "ready",
			appearance: {
				theme: "light",
				accent: "blue",
			},
			builtInPackageId: "built-in",
			heroReady: true,
			splashCompleted: false,
		});

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
							});
				}),
			}),
		);

		await expect(Effect.runPromise(startup.startFx)).rejects.toThrow("bridge unavailable");
		expect(startup.getSnapshot()).toEqual({
			type: "failed",
			appearance: null,
			error: failure,
			heroReady: false,
			splashCompleted: false,
		});

		await Effect.runPromise(startup.retryFx);
		expect(attempt).toBe(2);
		expect(startup.getSnapshot().type).toBe("ready");
	});
});
