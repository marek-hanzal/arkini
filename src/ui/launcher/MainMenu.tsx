import { useSyncExternalStore } from "react";
import { useArkpacks } from "~/bridge/arkpack/useArkpacks";
import { Button, ButtonLink, PrimaryButton, PrimaryButtonLink } from "~/ui/button/Button";
import { useExitApplicationMutation } from "~/ui/launcher/mutation/useExitApplicationMutation";
import { useLauncherStartup } from "~/ui/launcher/useLauncherStartup";

/** Renders the semantic out-of-game launcher actions over authoritative startup state. */
export const MainMenu = () => {
	const { state: catalogState } = useArkpacks();
	const startup = useLauncherStartup();
	const startupState = useSyncExternalStore(
		startup.subscribe,
		startup.getSnapshot,
		startup.getSnapshot,
	);
	const exit = useExitApplicationMutation();
	const builtInPackageId =
		startupState.type === "ready" ? startupState.builtInPackageId : undefined;
	const builtInAvailable =
		builtInPackageId !== undefined &&
		catalogState.type === "ready" &&
		catalogState.arkpacks.some(
			(arkpack) => arkpack.source === "built-in" && arkpack.packageId === builtInPackageId,
		);

	return (
		<div
			className="grid w-full gap-4"
			data-ui="MainMenu"
		>
			<header className="grid gap-2 rounded-2xl border border-line bg-surface/80 p-4 text-center shadow-lg">
				<p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
					Included package
				</p>
				<h1 className="text-[clamp(1.25rem,4cqmin,1.875rem)] font-semibold">
					Choose The Path is included
				</h1>
				<p className="text-sm leading-6 text-muted">
					The bundled Arkini package already includes the Choose The Path expansion pack.
					Jump in directly or manage local arkpacks below.
				</p>
			</header>
			<nav
				className="grid w-full gap-2"
				aria-label="Main menu"
			>
				{builtInAvailable && builtInPackageId !== undefined ? (
					<PrimaryButtonLink
						to="/action/load-game/$packageId"
						preload={false}
						params={{
							packageId: builtInPackageId,
						}}
						className="rounded-xl"
					>
						Play included pack
					</PrimaryButtonLink>
				) : (
					<PrimaryButton
						className="rounded-xl"
						cursorIntent={
							catalogState.type === "failed" || startupState.type === "failed"
								? "not-allowed"
								: "progress"
						}
						disabled
					>
						{catalogState.type === "failed" || startupState.type === "failed"
							? "Included pack unavailable"
							: "Preparing included pack…"}
					</PrimaryButton>
				)}
				<ButtonLink
					to="/arkpacks"
					className="rounded-xl"
				>
					Arkpacks
				</ButtonLink>
				<ButtonLink
					to="/settings"
					className="rounded-xl"
				>
					Settings
				</ButtonLink>
				<ButtonLink
					to="/about"
					className="rounded-xl"
				>
					About
				</ButtonLink>
				<Button
					className="rounded-xl"
					cursorIntent={exit.isPending ? "progress" : undefined}
					disabled={exit.isPending}
					onClick={() => exit.mutate()}
				>
					{exit.isPending ? "Exiting…" : "Exit"}
				</Button>
				{catalogState.type === "failed" ? (
					<p className="text-center text-sm text-danger">
						Catalog failed: {String(catalogState.error)}
					</p>
				) : startupState.type === "failed" ? (
					<p className="text-center text-sm text-danger">
						Startup failed: {String(startupState.error)}
					</p>
				) : exit.isError ? (
					<p className="text-center text-sm text-danger">
						Exit failed: {String(exit.error)}
					</p>
				) : null}
			</nav>
		</div>
	);
};
