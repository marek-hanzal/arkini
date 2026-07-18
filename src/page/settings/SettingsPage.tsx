import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { ResponsiveModal } from "~/ui/modal/ResponsiveModal";
import { Settings } from "~/ui/settings/Settings";

/** Composes standalone Settings with history-aware route navigation. */
export const SettingsPage = () => {
	const router = useRouter();
	const navigate = useNavigate();
	const goBack = useCallback(() => {
		if (router.history.canGoBack()) {
			router.history.back();
			return;
		}
		void navigate({
			to: "/main-menu",
			replace: true,
		});
	}, [
		navigate,
		router,
	]);

	return (
		<LauncherScene
			compactHero
			dataUi="SettingsPage"
		>
			<ResponsiveModal labelledBy="settings-title">
				<Settings onBack={goBack} />
			</ResponsiveModal>
		</LauncherScene>
	);
};
