import { useAtom, useAtomValue } from "@effect/atom-react";
import type { Effect } from "effect";
import { useCallback, useEffect } from "react";

import { AppearanceAtom } from "~/application-settings/atom/AppearanceAtom";
import type { AppearanceThemeSchema } from "~electron/contract/appearance/AppearanceThemeSchema";
import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";
import { WindowModeAtom } from "~/window-mode/atom/WindowModeAtom";
import { useCheatAvailability } from "~/application-settings/ui/useCheatAvailability";
import {
	SettingsCommandAtom,
	type SettingsCommandState,
} from "~/application-settings/atom/SettingsCommandAtom";

export namespace useSettingsModel {
	export interface Output {
		readonly blocked: boolean;
		readonly cheatToolsAvailable: boolean;
		readonly status: SettingsCommandState;
		readonly theme: AppearanceThemeSchema.Type;
		readonly windowMode: WindowModeSchema.Type;
		readonly goBackFn: () => void;
		readonly selectThemeFn: (theme: AppearanceThemeSchema.Type) => void;
		readonly selectWindowModeFn: (mode: WindowModeSchema.Type) => void;
		readonly setCheatToolsAvailableFn: (available: boolean) => void;
	}
}

/** Owns application settings commands and the one Escape lifecycle for the settings surface. */
export const useSettingsModel = ({
	onBackFx,
}: {
	readonly onBackFx: Effect.Effect<void, unknown, never>;
}): useSettingsModel.Output => {
	const appearance = useAtomValue(AppearanceAtom);
	const cheatAvailability = useCheatAvailability();
	const windowMode = useAtomValue(WindowModeAtom);
	const [commandState, runCommandFn] = useAtom(SettingsCommandAtom);
	const blocked = commandState.kind === "pending";
	const goBackFn = useCallback(() => {
		runCommandFn({
			action: "exit",
			runFx: onBackFx,
		});
	}, [
		onBackFx,
		runCommandFn,
	]);
	useEffect(() => {
		const onKeyDownFn = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || blocked) return;
			event.preventDefault();
			goBackFn();
		};
		window.addEventListener("keydown", onKeyDownFn);
		return () => window.removeEventListener("keydown", onKeyDownFn);
	}, [
		blocked,
		goBackFn,
	]);

	return {
		blocked,
		cheatToolsAvailable: cheatAvailability.available,
		status: commandState,
		theme: appearance.theme,
		windowMode,
		goBackFn,
		selectThemeFn: (theme: AppearanceThemeSchema.Type) => {
			runCommandFn({
				action: "theme",
				theme,
			});
		},
		selectWindowModeFn: (mode: WindowModeSchema.Type) => {
			runCommandFn({
				action: "window-mode",
				mode,
			});
		},
		setCheatToolsAvailableFn: (available: boolean) => {
			runCommandFn({
				action: "cheat-tools",
				available,
			});
		},
	};
};
