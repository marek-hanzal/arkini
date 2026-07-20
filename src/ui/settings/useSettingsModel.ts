import { useEffect } from "react";
import { match, P } from "ts-pattern";

import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { useAppearance } from "~/ui/appearance/useAppearance";
import { useSetAppearanceThemeMutation } from "~/ui/appearance/mutation/useSetAppearanceThemeMutation";

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
				readonly kind: "saving";
		  }
		| {
				readonly kind: "save-error";
				readonly message: string;
		  }
		| {
				readonly kind: "saved";
		  };
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Owns settings mutation interpretation and the one Escape lifecycle for the settings surface. */
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
	const setTheme = useSetAppearanceThemeMutation();
	const blocked = setTheme.isPending || exitPending;

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
		setTheme.isPending,
		setTheme.isError,
		setTheme.isSuccess,
	] as const)
		.with(
			[
				true,
				P._,
				P._,
			],
			(): useSettingsModel.Status => ({
				kind: "saving",
			}),
		)
		.with(
			[
				false,
				true,
				P._,
			],
			(): useSettingsModel.Status => ({
				kind: "save-error",
				message: errorMessage(setTheme.error),
			}),
		)
		.with(
			[
				false,
				false,
				true,
			],
			(): useSettingsModel.Status => ({
				kind: "saved",
			}),
		)
		.with(
			[
				false,
				false,
				false,
			],
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
		theme: appearance.theme,
		blocked,
		exitPending,
		status,
		selectTheme: (theme: AppearanceTheme) => setTheme.mutate(theme),
	};
};
