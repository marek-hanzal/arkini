import { useAtom, useAtomValue } from "@effect/atom-react";
import type { Effect } from "effect";
import { useCallback, useEffect } from "react";
import { match } from "ts-pattern";

import { AppearanceAtom } from "~/bridge/appearance/AppearanceAtom";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { SettingsCommandAtom } from "~/ui/settings/SettingsCommandAtom";

export namespace useSettingsModel {
	export type Status =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "navigation-error";
				readonly message: string;
		  }
		| {
				readonly kind: "saving-cheat-tools";
		  }
		| {
				readonly kind: "saving-theme";
		  }
		| {
				readonly kind: "save-error";
				readonly label: "Cheat tools" | "Theme";
				readonly message: string;
		  }
		| {
				readonly kind: "saved";
				readonly label: "Cheat tools" | "Theme";
		  };
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

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

	const status = match(commandState)
		.with(
			{
				kind: "pending",
				action: "cheat-tools",
			},
			(): useSettingsModel.Status => ({
				kind: "saving-cheat-tools",
			}),
		)
		.with(
			{
				kind: "pending",
				action: "theme",
			},
			(): useSettingsModel.Status => ({
				kind: "saving-theme",
			}),
		)
		.with(
			{
				kind: "pending",
				action: "exit",
			},
			(): useSettingsModel.Status => ({
				kind: "idle",
			}),
		)
		.with(
			{
				kind: "save-error",
			},
			({ error, label }): useSettingsModel.Status => ({
				kind: "save-error",
				label,
				message: errorMessage(error),
			}),
		)
		.with(
			{
				kind: "saved",
			},
			({ label }): useSettingsModel.Status => ({
				kind: "saved",
				label,
			}),
		)
		.with(
			{
				kind: "navigation-error",
			},
			({ error }): useSettingsModel.Status => ({
				kind: "navigation-error",
				message: errorMessage(error),
			}),
		)
		.with(
			{
				kind: "idle",
			},
			(): useSettingsModel.Status => ({
				kind: "idle",
			}),
		)
		.exhaustive();

	return {
		blocked,
		cheatToolsAvailable: cheatAvailability.available,
		exitPending,
		status,
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
