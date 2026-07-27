import { useAtom, useAtomValue } from "@effect/atom-react";
import type { Effect } from "effect";
import { useCallback, useEffect } from "react";

import { AppearanceAtom } from "~/bridge/appearance/AppearanceAtom";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { SettingsCommandAtom } from "~/ui/settings/SettingsCommandAtom";

/** Owns application settings commands and the one Escape lifecycle for the settings surface. */
export const useSettingsModel = ({
	onBackFx,
}: {
	readonly onBackFx: Effect.Effect<void, unknown>;
}) => {
	const appearance = useAtomValue(AppearanceAtom);
	const cheatAvailability = useCheatAvailability();
	const [commandState, runCommand] = useAtom(SettingsCommandAtom);
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
		exitPending,
		status: commandState,
		theme: appearance.theme,
		goBack,
		selectTheme: (theme: AppearanceTheme) => {
			runCommand({
				action: "theme",
				theme,
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
