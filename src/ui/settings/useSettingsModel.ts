import { useEffect } from "react";
import { match, P } from "ts-pattern";

import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { useActiveGameCheats } from "~/bridge/cheat/useActiveGameCheats";
import { useSetCheatEnabledMutation } from "~/bridge/cheat/useSetCheatEnabledMutation";
import { useSetAppearanceThemeMutation } from "~/ui/appearance/mutation/useSetAppearanceThemeMutation";
import { useAppearance } from "~/ui/appearance/useAppearance";

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
				readonly kind: "saving-cheat-mode";
		  }
		| {
				readonly kind: "saving-theme";
		  }
		| {
				readonly kind: "save-error";
				readonly label: "Cheat mode" | "Theme";
				readonly message: string;
		  }
		| {
				readonly kind: "saved";
				readonly label: "Cheat mode" | "Theme";
		  };
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Owns settings mutations and the one Escape lifecycle for the settings surface. */
export const useSettingsModel = ({
	exitPending,
	navigationError,
	onBack,
}: {
	readonly exitPending: boolean;
	readonly navigationError: unknown;
	readonly onBack: () => void;
}) => {
	const appearance = useAppearance();
	const activeGame = useActiveGameCheats();
	const setTheme = useSetAppearanceThemeMutation();
	const setCheatEnabled = useSetCheatEnabledMutation(activeGame.game);
	const blocked = setTheme.isPending || setCheatEnabled.isPending || exitPending;

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || blocked) return;
			event.preventDefault();
			onBack();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		blocked,
		onBack,
	]);

	const mutationStatus = match([
		setCheatEnabled.isPending,
		setCheatEnabled.isError,
		setCheatEnabled.isSuccess,
		setTheme.isPending,
		setTheme.isError,
		setTheme.isSuccess,
	] as const)
		.with(
			[
				true,
				P._,
				P._,
				P._,
				P._,
				P._,
			],
			(): useSettingsModel.Status => ({
				kind: "saving-cheat-mode",
			}),
		)
		.with(
			[
				false,
				true,
				P._,
				P._,
				P._,
				P._,
			],
			(): useSettingsModel.Status => ({
				kind: "save-error",
				label: "Cheat mode",
				message: errorMessage(setCheatEnabled.error),
			}),
		)
		.with(
			[
				false,
				false,
				P._,
				true,
				P._,
				P._,
			],
			(): useSettingsModel.Status => ({
				kind: "saving-theme",
			}),
		)
		.with(
			[
				false,
				false,
				P._,
				false,
				true,
				P._,
			],
			(): useSettingsModel.Status => ({
				kind: "save-error",
				label: "Theme",
				message: errorMessage(setTheme.error),
			}),
		)
		.with(
			[
				false,
				false,
				true,
				false,
				false,
				P._,
			],
			(): useSettingsModel.Status => ({
				kind: "saved",
				label: "Cheat mode",
			}),
		)
		.with(
			[
				false,
				false,
				false,
				false,
				false,
				true,
			],
			(): useSettingsModel.Status => ({
				kind: "saved",
				label: "Theme",
			}),
		)
		.with(
			P._,
			(): useSettingsModel.Status => ({
				kind: "idle",
			}),
		)
		.exhaustive();
	const status: useSettingsModel.Status =
		navigationError === undefined
			? mutationStatus
			: {
					kind: "navigation-error",
					message: errorMessage(navigationError),
				};

	return {
		blocked,
		cheatMode: activeGame.cheats?.enabled ?? null,
		exitPending,
		status,
		theme: appearance.theme,
		selectTheme: (theme: AppearanceTheme) => setTheme.mutate(theme),
		setCheatMode: (enabled: boolean) => setCheatEnabled.mutate(enabled),
	};
};
