import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { ResponsiveModal } from "~/ui/modal/ResponsiveModal";
import { routeSceneViewTransitionName } from "~/ui/navigation/routeSceneViewTransitionName";
import { Settings } from "~/ui/settings/Settings";
import { settingsModalViewTransitionName } from "~/ui/settings/settingsModalViewTransitionName";

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
			viewTransitionName={routeSceneViewTransitionName}
		>
			<ResponsiveModal
				labelledBy="settings-title"
				viewTransitionName={settingsModalViewTransitionName}
			>
				<Settings onBack={goBack} />
			</ResponsiveModal>
		</LauncherScene>
	);
};
