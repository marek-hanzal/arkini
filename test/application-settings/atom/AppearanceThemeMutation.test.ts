import { scheduleTask } from "@effect/atom-react";
import { Cause, Effect, Exit, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppearanceAtom } from "~/application-settings/atom/AppearanceAtom";
import type { AppearanceThemeSchema } from "~electron/contract/appearance/AppearanceThemeSchema";
import { AppearanceThemeError } from "~/application-settings/error/AppearanceThemeError";
import { setAppearanceThemeAtom } from "~/application-settings/atom/setAppearanceThemeAtom";

const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
	vi.restoreAllMocks();
	Reflect.deleteProperty(globalThis, "window");
});

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		initialValues: [
			[
				AppearanceAtom,
				{
					theme: "dark" as const,
					accent: "rose" as const,
				},
			],
		],
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

const installDesktopAppearance = (write: (theme: AppearanceThemeSchema.Type) => Promise<void>) => {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			arkini: {
				appearance: {
					writeFn: write,
				},
			},
		},
	});
};

const runThemeCommand = (
	registry: AtomRegistry.AtomRegistry,
	theme: AppearanceThemeSchema.Type,
) => {
	registry.set(setAppearanceThemeAtom, theme);
	return Effect.runPromiseExit(
		AtomRegistry.getResult(registry, setAppearanceThemeAtom, {
			suspendOnWaiting: true,
		}),
	);
};

describe("setAppearanceThemeAtom", () => {
	it("applies immediately, persists once and no-ops the active value", async () => {
		let resolveWrite: () => void = () => undefined;
		const write = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveWrite = resolve;
				}),
		);
		installDesktopAppearance(write);
		const registry = makeRegistry();
		const completed = runThemeCommand(registry, "light");

		expect(registry.get(AppearanceAtom).theme).toBe("light");
		expect(registry.get(setAppearanceThemeAtom).waiting).toBe(true);
		await vi.waitFor(() => expect(write).toHaveBeenCalledWith("light"));
		resolveWrite();
		expect(await completed).toEqual(Exit.succeed(undefined));
		expect(AsyncResult.isSuccess(registry.get(setAppearanceThemeAtom))).toBe(true);

		expect(await runThemeCommand(registry, "light")).toEqual(Exit.succeed(undefined));
		expect(write).toHaveBeenCalledOnce();
	});

	it("rolls back its optimistic value and preserves the typed persistence failure", async () => {
		const persistenceFailure = new Error("theme write failed");
		installDesktopAppearance(() => Promise.reject(persistenceFailure));
		const registry = makeRegistry();

		const exit = await runThemeCommand(registry, "light");

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected theme write failure.");
		const failure = Cause.findErrorOption(exit.cause);
		expect(Option.isSome(failure)).toBe(true);
		if (Option.isNone(failure)) throw new Error("Expected typed theme failure.");
		expect(failure.value).toBeInstanceOf(AppearanceThemeError);
		expect(failure.value.cause).toBe(persistenceFailure);
		expect(registry.get(AppearanceAtom).theme).toBe("dark");
	});

	it("serializes writes so an older completion cannot overwrite a newer theme", async () => {
		let persisted: AppearanceThemeSchema.Type = "dark";
		const completions = new Map<AppearanceThemeSchema.Type, () => void>();
		const write = vi.fn(
			(theme: AppearanceThemeSchema.Type) =>
				new Promise<void>((resolve) => {
					completions.set(theme, () => {
						persisted = theme;
						resolve();
					});
				}),
		);
		installDesktopAppearance(write);
		const registry = makeRegistry();
		registry.mount(setAppearanceThemeAtom);

		registry.set(setAppearanceThemeAtom, "light");
		expect(registry.get(AppearanceAtom).theme).toBe("light");
		registry.set(setAppearanceThemeAtom, "system");
		expect(registry.get(AppearanceAtom).theme).toBe("system");
		await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
		expect(write.mock.calls).toEqual([
			[
				"light",
			],
		]);

		completions.get("light")?.();
		await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
		expect(write.mock.calls[1]).toEqual([
			"system",
		]);
		expect(persisted).toBe("light");

		completions.get("system")?.();
		const exit = await Effect.runPromiseExit(
			AtomRegistry.getResult(registry, setAppearanceThemeAtom, {
				suspendOnWaiting: true,
			}),
		);
		expect(exit).toEqual(Exit.succeed(undefined));
		expect(registry.get(AppearanceAtom).theme).toBe("system");
		expect(persisted).toBe("system");
	});
});
