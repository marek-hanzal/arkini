import { ArkpackCatalogList } from "~/ui/arkpack/ArkpackCatalogList";
import { useArkpackSelectorActions } from "~/ui/arkpack/useArkpackSelectorActions";
import { PrimaryButton } from "~/ui/button/Button";

/** Selects a bundled or locally imported game package without uploading it anywhere. */
export const ArkpackSelector = () => {
	const actions = useArkpackSelectorActions();
	const blocked = actions.busy || actions.exitPending;

	return (
		<div
			className="grid h-full min-h-0 w-full grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-[var(--ak-viewport-gap)]"
			data-ui="ArkpackSelector"
		>
			<header>
				<p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
					Packages
				</p>
				<h1
					id="arkpack-selector-title"
					className="mt-2 text-[clamp(1.25rem,4cqmin,1.875rem)] font-semibold"
				>
					Choose an installed package
				</h1>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
					The built-in Arkini package already includes Choose The Path. Imported arkpacks
					stay on this device and every package is validated before it can run.
				</p>
			</header>

			<section className="rounded-2xl border border-line bg-surface/80 p-4">
				<input
					ref={actions.inputRef}
					type="file"
					accept=".arkpack,application/octet-stream"
					className="block min-w-0 w-full cursor-pointer text-sm disabled:cursor-progress file:cursor-pointer text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:font-semibold file:text-accent-contrast hover:file:bg-accent-hover"
					disabled={blocked}
					onChange={(event) => void actions.upload(event.currentTarget.files?.[0])}
				/>
				{actions.busy ? (
					<p className="mt-3 text-sm text-accent">Validating package…</p>
				) : null}
				{actions.actionError === undefined ? null : (
					<p className="mt-3 text-sm text-danger">{String(actions.actionError)}</p>
				)}
			</section>

			<section className="scrollbar-hidden grid min-h-0 content-start gap-3 overflow-y-auto overscroll-contain">
				<ArkpackCatalogList
					state={actions.state}
					onRemove={actions.removeArkpack}
				/>
			</section>

			<footer className="flex justify-center pb-[env(safe-area-inset-bottom)]">
				<PrimaryButton
					cursorIntent={blocked ? "progress" : undefined}
					disabled={blocked}
					onClick={actions.requestMainMenu}
				>
					{actions.exitPending ? "Returning…" : "Return to main menu"}
				</PrimaryButton>
			</footer>
		</div>
	);
};
