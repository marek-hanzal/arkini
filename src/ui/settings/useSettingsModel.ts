import { useAtom, useAtomValue } from "@effect/atom-react";
import type { Effect } from "effect";
import { useCallback, useEffect } from "react";

import { AppearanceAtom } from "~/bridge/appearance/AppearanceAtom";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import type { WindowMode } from "~/bridge/window/WindowMode";
import { WindowModeAtom } from "~/bridge/window/WindowModeAtom";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { useSettingsDirectoriesModel } from "~/ui/settings/useSettingsDirectoriesModel";
import { useSettingsMcpModel } from "~/ui/settings/useSettingsMcpModel";
import { SettingsCommandAtom } from "~/ui/settings/SettingsCommandAtom";

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
	const mcp = useSettingsMcpModel();
	const directories = useSettingsDirectoriesModel();
	const blocked = commandState.kind === "pending";
	const exitPending = commandState.kind === "pending" && commandState.action === "exit";
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
		...mcp,
		exitPending,
		...directories,
		status: commandState,
		theme: appearance.theme,
		windowMode,
		goBack,
		selectTheme: (theme: AppearanceTheme) => {
			runCommand({
				action: "theme",
				theme,
			});
		},
		selectWindowMode: (mode: WindowMode) => {
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
