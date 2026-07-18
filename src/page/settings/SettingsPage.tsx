import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";
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
		<MainPageLayout
			labelledBy="settings-title"
			page="settings"
		>
			<Settings onBack={goBack} />
		</MainPageLayout>
	);
};
