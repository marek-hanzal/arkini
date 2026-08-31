import { createFileRoute, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import { useMemo } from "react";
import { match } from "ts-pattern";

import { BackButton } from "~/ui/ui/BackButton";
import { ButtonLink } from "~/ui/ui/Button";
import { LauncherPageLayout } from "~/launcher/ui/LauncherPageLayout";
import { ModelProvider } from "~/application-settings/ui/ModelContext";
import { useSettingsModel } from "~/application-settings/ui/useSettingsModel";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const sections = [
	{
		id: "common",
		label: "Common",
	},
	{
		id: "game",
		label: "Game",
	},
	{
		id: "dev",
		label: "Dev",
	},
] as const;

const tabClassName =
	"min-h-9 rounded-lg border border-b-2 border-accent/20 border-b-accent/35 bg-accent/5 px-3 py-2 text-sm text-foreground shadow-none hover:bg-accent/10 data-[ui-selected=true]:border-accent/40 data-[ui-selected=true]:border-b-accent/75 data-[ui-selected=true]:bg-accent/15 data-[ui-selected=true]:text-accent data-[ui-selected=true]:hover:bg-accent/20";

export const Route = createFileRoute("/_launcher/settings")({
	/** Composes standalone Settings with history-aware route navigation. */
	component: () => {
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
		const model = useSettingsModel({
			onBackFx,
		});

		return (
			<LauncherPageLayout page="settings">
				<ModelProvider model={model}>
					<section
						className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto_auto] gap-5"
						data-ui="Settings"
					>
						<header className="text-center">
							<h1 className="text-2xl font-semibold">Settings</h1>
						</header>

						<nav
							className="min-w-0 overflow-x-auto overscroll-x-contain"
							data-ui="SettingsSectionTabs"
						>
							<div className="flex min-w-max items-center gap-2 py-1">
								{sections.map((section) => (
									<ButtonLink
										key={section.id}
										to={`/settings/${section.id}`}
										replace
										activeOptions={{
											exact: true,
										}}
										activeProps={{
											"data-ui-selected": true,
										}}
										className={tabClassName}
									>
										{section.label}
									</ButtonLink>
								))}
							</div>
						</nav>

						<div
							className="min-h-0 overflow-y-auto"
							data-ui="SettingsContent"
							style={{
								viewTransitionName: "arkini-settings-content",
							}}
						>
							<Outlet />
						</div>

						<div
							className="min-h-6 text-center text-sm"
							data-ui="SettingsStatus"
						>
							{match(model.status)
								.with(
									{
										kind: "pending",
										action: "window-mode",
									},
									() => <p className="text-accent">Applying window mode…</p>,
								)
								.with(
									{
										kind: "navigation-error",
									},
									({ error }) => (
										<p className="text-danger">
											Navigation failed: {errorMessage(error)}
										</p>
									),
								)
								.with(
									{
										kind: "pending",
										action: "cheat-tools",
									},
									() => <p className="text-accent">Saving Cheat tools…</p>,
								)
								.with(
									{
										kind: "pending",
										action: "theme",
									},
									() => <p className="text-accent">Saving theme…</p>,
								)
								.with(
									{
										kind: "pending",
										action: "exit",
									},
									() => null,
								)
								.with(
									{
										kind: "save-error",
									},
									({ error, label }) => (
										<p className="text-danger">
											{label} update failed: {errorMessage(error)}
										</p>
									),
								)
								.with(
									{
										kind: "saved",
									},
									({ label }) => <p className="text-muted">{label} saved.</p>,
								)
								.with(
									{
										kind: "idle",
									},
									() => null,
								)
								.exhaustive()}
						</div>

						<BackButton
							cursorIntent={model.blocked ? "progress" : undefined}
							disabled={model.blocked}
							onClick={model.goBack}
						/>
					</section>
				</ModelProvider>
			</LauncherPageLayout>
		);
	},
});
