import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useExclusiveAction } from "~/ui/action/useExclusiveAction";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";
import { Settings } from "~/ui/settings/Settings";

/** Composes standalone Settings with history-aware route navigation. */
export const SettingsPage = () => {
	const router = useRouter();
	const navigate = useNavigate();
	const mountedRef = useRef(false);
	const [navigationError, setNavigationError] = useState<unknown>();
	const { active, claim, release } = useExclusiveAction<"exit">();
	const exitPending = active === "exit";

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const goBack = useCallback(() => {
		if (!claim("exit")) return;
		setNavigationError(undefined);
		if (router.history.canGoBack()) {
			try {
				router.history.back();
			} catch (error) {
				if (mountedRef.current) setNavigationError(error);
				release("exit");
			}
			return;
		}
		void (async () => {
			try {
				await navigate({
					to: "/main-menu",
					replace: true,
				});
			} catch (error) {
				if (mountedRef.current) setNavigationError(error);
			} finally {
				release("exit");
			}
		})();
	}, [
		claim,
		navigate,
		release,
		router,
	]);

	return (
		<MainPageLayout
			labelledBy="settings-title"
			page="settings"
		>
			<Settings
				exitPending={exitPending}
				navigationError={navigationError}
				onBack={goBack}
			/>
		</MainPageLayout>
	);
};
