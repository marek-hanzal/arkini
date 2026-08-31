import { useAtom, useAtomValue } from "@effect/atom-react";
import type { Effect } from "effect";
import { useCallback, useEffect } from "react";

import { AppearanceAtom } from "~/application-settings/atom/AppearanceAtom";
import type { AppearanceThemeSchema } from "../../../electron/contract/appearance/AppearanceThemeSchema";
import type { WindowModeSchema } from "../../../electron/contract/window/WindowModeSchema";
import { WindowModeAtom } from "~/window-mode/atom/WindowModeAtom";
import { useCheatAvailability } from "~/application-settings/ui/useCheatAvailability";
import { SettingsCommandAtom } from "~/application-settings/atom/SettingsCommandAtom";

/** Owns application settings commands and the one Escape lifecycle for the settings surface. */
export const useSettingsModel = ({
	onBackFx,
}: {
	readonly onBackFx: Effect.Effect<void, unknown>;
}) => {
	const appearance = useAtomValue(AppearanceAtom);
	const cheatAvailability = useCheatAvailability();
	const windowMode = useAtomValue(WindowModeAtom);
	const [commandState, runCommand] = useAtom(SettingsCommandAtom);
	const blocked = commandState.kind === "pending";
	const goBack = useCallback(() => {
		runCommand({
			action: "exit",
			runFx: onBackFx,
		});
	}, [
		onBackFx,
		runCommand,
	]);
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || blocked) return;
			event.preventDefault();
			goBack();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		blocked,
		goBack,
	]);

	return {
		blocked,
		cheatToolsAvailable: cheatAvailability.available,
		status: commandState,
		theme: appearance.theme,
		windowMode,
		goBack,
		selectTheme: (theme: AppearanceThemeSchema.Type) => {
			runCommand({
				action: "theme",
				theme,
			});
		},
		selectWindowMode: (mode: WindowModeSchema.Type) => {
			runCommand({
				action: "window-mode",
				mode,
			});
		},
		setCheatToolsAvailable: (available: boolean) => {
			runCommand({
				action: "cheat-tools",
				available,
			});
		},
	};
};
