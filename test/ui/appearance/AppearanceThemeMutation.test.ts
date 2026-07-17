import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import type { AppearanceContext } from "~/ui/appearance/AppearanceContext";
import { setAppearanceThemeMutationOptions } from "~/ui/appearance/mutation/setAppearanceThemeMutationOptions";

const executeMutation = async (
	options: ReturnType<typeof setAppearanceThemeMutationOptions>,
	theme: AppearanceTheme,
) => {
	if (options.mutationFn === undefined) throw new Error("Expected a mutation function.");
	return options.mutationFn(theme, {
		client: new QueryClient(),
		meta: options.meta,
		mutationKey: options.mutationKey,
	});
};

const createAppearance = () => {
	let theme: AppearanceTheme = "dark";
	const applyTheme = vi.fn((nextTheme: AppearanceTheme) => {
		theme = nextTheme;
	});
	const appearance: AppearanceContext.Value = {
		get theme() {
			return theme;
		},
		accent: "rose",
		applyTheme,
		hydrate: () => undefined,
	};
	return {
		appearance,
		applyTheme,
		getTheme: () => theme,
	};
};

const installDesktopAppearance = (write: (theme: AppearanceTheme) => Promise<void>) => {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			arkini: {
				appearance: {
					write,
				},
			},
		},
	});
};

describe("setAppearanceThemeMutationOptions", () => {
	it("owns immediate application, durable persistence, and active-value no-op", async () => {
		const write = vi.fn(() => Promise.resolve());
		installDesktopAppearance(write);
		const { appearance, applyTheme, getTheme } = createAppearance();
		const options = setAppearanceThemeMutationOptions(appearance);

		expect(options.mutationKey).toEqual([
			"appearance",
			"theme",
		]);
		expect(options.retry).toBe(false);
		await executeMutation(options, "system");
		expect(getTheme()).toBe("system");
		expect(applyTheme).toHaveBeenCalledWith("system");
		expect(write).toHaveBeenCalledOnce();
		expect(write).toHaveBeenCalledWith("system");

		await executeMutation(options, "system");
		expect(write).toHaveBeenCalledOnce();
		Reflect.deleteProperty(globalThis, "window");
	});

	it("rolls the renderer back and preserves the persistence failure", async () => {
		const failure = new Error("theme write failed");
		installDesktopAppearance(() => Promise.reject(failure));
		const { appearance, applyTheme, getTheme } = createAppearance();
		const options = setAppearanceThemeMutationOptions(appearance);

		await expect(executeMutation(options, "light")).rejects.toBeDefined();
		expect(getTheme()).toBe("dark");
		expect(applyTheme.mock.calls).toEqual([
			[
				"light",
			],
			[
				"dark",
			],
		]);
		Reflect.deleteProperty(globalThis, "window");
	});
});
