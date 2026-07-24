import { useEffect } from "react";
import { match, P } from "ts-pattern";

import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { useSetAppearanceThemeMutation } from "~/ui/appearance/mutation/useSetAppearanceThemeMutation";
import { useAppearance } from "~/ui/appearance/useAppearance";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { useSetCheatAvailabilityMutation } from "~/ui/cheat-availability/useSetCheatAvailabilityMutation";
import { useExclusiveAction } from "~/ui/action/useExclusiveAction";

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

type SettingsAction = "cheat-tools" | "theme";

/** Owns application settings mutations and the one Escape lifecycle for the settings surface. */
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
	const cheatAvailability = useCheatAvailability();
	const setTheme = useSetAppearanceThemeMutation();
	const setCheatAvailability = useSetCheatAvailabilityMutation();
	const { active, claim, release } = useExclusiveAction<SettingsAction>();
	const blocked = active !== null || exitPending;

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
		active,
		setCheatAvailability.isError,
		setCheatAvailability.isSuccess,
		setTheme.isError,
		setTheme.isSuccess,
	] as const)
		.with(
			[
				"cheat-tools",
				P._,
				P._,
				P._,
				P._,
			],
			(): useSettingsModel.Status => ({
				kind: "saving-cheat-tools",
			}),
		)
		.with(
			[
				null,
				true,
				P._,
				P._,
				P._,
			],
			(): useSettingsModel.Status => ({
				kind: "save-error",
				label: "Cheat tools",
				message: errorMessage(setCheatAvailability.error),
			}),
		)
		.with(
			[
				"theme",
				P._,
				P._,
				P._,
				P._,
			],
			(): useSettingsModel.Status => ({
				kind: "saving-theme",
			}),
		)
		.with(
			[
				null,
				false,
				P._,
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
				null,
				false,
				true,
				P._,
				P._,
			],
			(): useSettingsModel.Status => ({
				kind: "saved",
				label: "Cheat tools",
			}),
		)
		.with(
			[
				null,
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
		cheatToolsAvailable: cheatAvailability.available,
		exitPending,
		status,
		theme: appearance.theme,
		selectTheme: (theme: AppearanceTheme) => {
			if (!claim("theme")) return;
			setCheatAvailability.reset();
			setTheme.mutate(theme, {
				onSettled: () => release("theme"),
			});
		},
		setCheatToolsAvailable: (available: boolean) => {
			if (!claim("cheat-tools")) return;
			setTheme.reset();
			setCheatAvailability.mutate(available, {
				onSettled: () => release("cheat-tools"),
			});
		},
	};
};
