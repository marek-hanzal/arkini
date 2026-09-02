import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import { PrimaryButton } from "~/ui/ui/Button";
import { LauncherSplashCompletedAtom } from "~/launcher/atom/LauncherSplashCompletedAtom";
import { LauncherScene } from "~/launcher/ui/LauncherScene";
import { useStartupSplashLifecycle } from "~/launcher/ui/useStartupSplashLifecycle";

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
		const failureFn = (message: string) => (
			<div className="grid max-w-lg gap-3 rounded-2xl border border-danger/35 bg-surface p-4 text-center text-foreground shadow-xl">
				<p className="font-semibold text-danger">Startup failed</p>
				<p>{message}</p>
				<PrimaryButton
					className="mx-auto"
					onClick={lifecycle.retryFn}
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
						data-ui="StartupBlackWait"
					/>
				),
			)
			.with(
				{
					kind: "failure",
				},
				({ message }) => (
					<main
						className="grid size-full cursor-default place-items-center bg-canvas p-6 text-foreground"
						data-ui="StartupFailure"
					>
						{failureFn(message)}
					</main>
				),
			)
			.with(
				{
					kind: "scene",
				},
				({ content }) => (
					<div
						className="size-full bg-black"
						data-ui="StartupSplashBackdrop"
					>
						<div
							className="size-full"
							data-ui="StartupSplashReveal"
						>
							<LauncherScene
								cursor={content.kind === "loading" ? "wait" : "default"}
								dataUi="StartupSplash"
								onClickFn={lifecycle.skipFn}
							>
								<div
									className="min-h-14 text-center text-sm text-muted"
									data-ui="StartupSplashContent"
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
											({ message }) => failureFn(message),
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
						</div>
					</div>
				),
			)
			.exhaustive();
	},
});
