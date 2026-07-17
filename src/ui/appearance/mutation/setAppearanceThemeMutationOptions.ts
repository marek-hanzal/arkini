import { mutationOptions } from "@tanstack/react-query";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { writeAppearanceThemeFx } from "~/bridge/appearance/writeAppearanceThemeFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { AppearanceContext } from "~/ui/appearance/AppearanceContext";

/** Complete mutation contract for one immediate and durable theme preference change. */
export const setAppearanceThemeMutationOptions = (appearance: AppearanceContext.Value) =>
	mutationOptions({
		mutationKey: [
			"appearance",
			"theme",
		] as const,
		mutationFn: async (nextTheme: AppearanceTheme) => {
			const previousTheme = appearance.theme;
			if (nextTheme === previousTheme) return;

			appearance.applyTheme(nextTheme);
			try {
				await RendererRuntime.runPromise(writeAppearanceThemeFx(nextTheme));
			} catch (error) {
				appearance.applyTheme(previousTheme);
				throw error;
			}
		},
		retry: false,
	});
