import { Link } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { useArkpacks } from "~/bridge/arkpack/useArkpacks";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { useLauncherStartup } from "~/ui/launcher/useLauncherStartup";
import { useExitApplicationMutation } from "~/ui/launcher/mutation/useExitApplicationMutation";

/** Renders the semantic out-of-game launcher menu over authoritative startup and catalog state. */
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
		<LauncherScene
			compactHero
			dataUi="MainMenu"
		>
			<nav
				className="grid w-full max-w-xs gap-2"
				aria-label="Main menu"
			>
				{builtInAvailable && builtInPackageId !== undefined ? (
					<Link
						to="/game/$packageId"
						params={{
							packageId: builtInPackageId,
						}}
						className="rounded-xl bg-accent px-5 py-3 text-center font-semibold text-accent-contrast shadow-lg transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						Play
					</Link>
				) : (
					<button
						type="button"
						className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-contrast opacity-60"
						disabled
					>
						{catalogState.type === "failed" || startupState.type === "failed"
							? "Play unavailable"
							: "Preparing Play…"}
					</button>
				)}
				<Link
					to="/arkpacks"
					className="rounded-xl border border-line bg-surface/75 px-5 py-3 text-center font-semibold shadow-lg backdrop-blur-md transition-colors hover:border-line-strong hover:bg-surface-raised"
				>
					Arkpacks
				</Link>
				<Link
					to="/settings"
					className="rounded-xl border border-line bg-surface/75 px-5 py-3 text-center font-semibold shadow-lg backdrop-blur-md transition-colors hover:border-line-strong hover:bg-surface-raised"
				>
					Settings
				</Link>
				<Link
					to="/about"
					className="rounded-xl border border-line bg-surface/75 px-5 py-3 text-center font-semibold shadow-lg backdrop-blur-md transition-colors hover:border-line-strong hover:bg-surface-raised"
				>
					About
				</Link>
				<button
					type="button"
					className="rounded-xl border border-line bg-surface/75 px-5 py-3 font-semibold shadow-lg backdrop-blur-md transition-colors hover:border-danger/45 hover:text-danger disabled:cursor-wait disabled:opacity-60"
					disabled={exit.isPending}
					onClick={() => exit.mutate()}
				>
					{exit.isPending ? "Exiting…" : "Exit"}
				</button>
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
		</LauncherScene>
	);
};
