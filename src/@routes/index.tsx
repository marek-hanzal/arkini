import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import { PrimaryButton } from "~/ui/button/Button";
import { LauncherSplashCompletedAtom } from "~/ui/launcher/LauncherSplashCompletedAtom";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { useStartupSplashLifecycle } from "~/ui/launcher/useStartupSplashLifecycle";
import { startupContentViewTransitionName } from "~/ui/navigation/startupContentViewTransitionName";

const readLauncherSplashCompletedFx = Effect.fn("readLauncherSplashCompletedFx")(() =>
	Atom.get(LauncherSplashCompletedAtom),
);

export const Route = createFileRoute("/")({
	beforeLoad: ({ context }) => {
		if (context.rendererRuntime.runSync(readLauncherSplashCompletedFx())) {
			throw redirect({
				to: "/main-menu",
			});
		}
	},
	component: () => {
		const lifecycle = useStartupSplashLifecycle();
		const failure = (message: string) => (
			<div className="grid max-w-lg gap-3 rounded-2xl border border-danger/35 bg-surface p-4 text-center text-foreground shadow-xl">
				<p className="font-semibold text-danger">Startup failed</p>
				<p>{message}</p>
				<PrimaryButton
					className="mx-auto"
					onClick={lifecycle.retry}
				>
					Retry
				</PrimaryButton>
			</div>
		);

		return match(lifecycle.view)
			.with(
				{
					kind: "black",
				},
				() => (
					<main
						className="size-full cursor-wait bg-black"
						data-ui="StartupBlackHold"
					/>
				),
			)
			.with(
				{
					kind: "failure",
				},
				({ message }) => (
					<main
						className="grid size-full cursor-default place-items-center bg-black p-6 text-white"
						data-ui="StartupFailure"
					>
						{failure(message)}
					</main>
				),
			)
			.with(
				{
					kind: "scene",
				},
				({ content }) => (
					<LauncherScene
						className={content.kind === "loading" ? "cursor-wait" : "cursor-default"}
						dataUi="StartupSplash"
						onClick={lifecycle.skip}
					>
						<div
							className="min-h-14 text-center text-sm text-muted"
							aria-live="polite"
							data-ui="StartupSplashContent"
							style={{
								viewTransitionName: startupContentViewTransitionName,
							}}
						>
							{match(content)
								.with(
									{
										kind: "loading",
									},
									() => <p>Preparing Arkini…</p>,
								)
								.with(
									{
										kind: "failure",
									},
									({ message }) => failure(message),
								)
								.with(
									{
										kind: "prompt",
									},
									() => (
										<p className="text-xs font-semibold uppercase tracking-[0.24em] text-subtle">
											Press Esc to continue
										</p>
									),
								)
								.with(
									{
										kind: "empty",
									},
									() => null,
								)
								.exhaustive()}
						</div>
					</LauncherScene>
				),
			)
			.exhaustive();
	},
});
