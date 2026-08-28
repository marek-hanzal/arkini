import { Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import { useMemo } from "react";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";
import { Settings } from "~/ui/settings/Settings";

/** Composes standalone Settings with history-aware route navigation. */
export const SettingsPage = () => {
	const router = useRouter();
	const navigate = useNavigate();
	const onBackFx = useMemo(() => {
		return Effect.suspend(() => {
			if (router.history.canGoBack()) {
				return Effect.try({
					try: () => router.history.back(),
					catch: (error) => error,
				});
			}
			return Effect.tryPromise({
				try: () =>
					navigate({
						to: "/main-menu",
						replace: true,
					}),
				catch: (error) => error,
			}).pipe(Effect.asVoid);
		});
	}, [
		navigate,
		router,
	]);

	return (
		<MainPageLayout
			heroPlacement="behind-panel"
			labelledBy="settings-title"
			page="settings"
			panelClassName="h-full"
			panelContentClassName="h-full"
		>
			<Settings onBackFx={onBackFx}>
				<Outlet />
			</Settings>
		</MainPageLayout>
	);
};
