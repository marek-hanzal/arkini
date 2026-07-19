import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";
import { Settings } from "~/ui/settings/Settings";

/** Composes standalone Settings with history-aware route navigation. */
export const SettingsPage = () => {
	const router = useRouter();
	const navigate = useNavigate();
	const mountedRef = useRef(false);
	const exitPendingRef = useRef(false);
	const [exitPending, setExitPending] = useState(false);
	const [navigationError, setNavigationError] = useState<unknown>();

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const goBack = useCallback(() => {
		if (exitPendingRef.current) return;
		exitPendingRef.current = true;
		setExitPending(true);
		setNavigationError(undefined);
		if (router.history.canGoBack()) {
			router.history.back();
			return;
		}
		void navigate({ to: "/main-menu", replace: true })
			.catch((error) => {
				if (mountedRef.current) setNavigationError(error);
			})
			.finally(() => {
				exitPendingRef.current = false;
				if (mountedRef.current) setExitPending(false);
			});
	}, [navigate, router]);

	return (
		<MainPageLayout labelledBy="settings-title" page="settings">
			<Settings
				exitPending={exitPending}
				navigationError={navigationError}
				onBack={goBack}
			/>
		</MainPageLayout>
	);
};
