import { match } from "ts-pattern";

import { PrimaryButton } from "~/ui/button/Button";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { useStartupSplashLifecycle } from "~/ui/launcher/useStartupSplashLifecycle";
import { startupContentViewTransitionName } from "~/ui/navigation/startupContentViewTransitionName";

const Failure = ({ message, retry }: { readonly message: string; readonly retry: () => void }) => (
	<div className="grid max-w-lg gap-3 rounded-2xl border border-danger/35 bg-surface p-4 text-center text-foreground shadow-xl">
		<p className="font-semibold text-danger">Startup failed</p>
		<p>{message}</p>
		<PrimaryButton
			className="mx-auto"
			onClick={retry}
		>
			Retry
		</PrimaryButton>
	</div>
);

/** Owns the one visible startup page before native navigation hands off to the launcher. */
export const StartupSplash = () => {
	const lifecycle = useStartupSplashLifecycle();

	return match(lifecycle.view)
		.with(
			{
				kind: "black",
			},
			() => (
				<main
					className="size-full bg-black"
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
					className="grid size-full place-items-center bg-black p-6 text-white"
					data-ui="StartupFailure"
				>
					<Failure
						message={message}
						retry={lifecycle.retry}
					/>
				</main>
			),
		)
		.with(
			{
				kind: "scene",
			},
			({ content }) => (
				<LauncherScene dataUi="StartupSplash">
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
								({ message }) => (
									<Failure
										message={message}
										retry={lifecycle.retry}
									/>
								),
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
};
