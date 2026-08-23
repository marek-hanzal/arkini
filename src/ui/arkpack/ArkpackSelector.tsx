import { ArkpackCatalogList } from "~/ui/arkpack/ArkpackCatalogList";
import { useArkpackSelectorActions } from "~/ui/arkpack/useArkpackSelectorActions";
import { BackButton } from "~/ui/button/BackButton";
import { Button } from "~/ui/button/Button";

/** Selects a bundled or user-owned game package without uploading it anywhere. */
export const ArkpackSelector = () => {
	const actions = useArkpackSelectorActions();
	const blocked = actions.blocked;

	return (
		<div
			className="grid h-full min-h-0 w-full grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-[var(--ak-viewport-gap)]"
			data-ui="ArkpackSelector"
		>
			<header>
				<p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
					Arkini arkpacks
				</p>
				<h1
					id="arkpack-selector-title"
					className="mt-2 text-[clamp(1.25rem,4cqmin,1.875rem)] font-semibold"
				>
					Choose a game package
				</h1>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
					User arkpacks stay on this device. Every package is validated before it can run.
				</p>
			</header>

			<section className="rounded-2xl border border-line bg-surface/80 p-4">
				<input
					ref={actions.inputRef}
					type="file"
					accept=".arkpack,application/octet-stream"
					className="block min-w-0 w-full cursor-pointer text-sm disabled:cursor-progress file:cursor-pointer disabled:file:cursor-progress text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:font-semibold file:text-accent-contrast hover:file:bg-accent-hover"
					disabled={blocked}
					onChange={(event) => void actions.upload(event.currentTarget.files?.[0])}
				/>
				<div className="mt-3 flex flex-wrap gap-2">
					<Button
						className="min-h-0 px-3 py-2 text-xs shadow-none"
						cursorIntent={blocked ? "progress" : undefined}
						disabled={blocked}
						onClick={actions.openArkpackDirectory}
					>
						Open Arkpack folder
					</Button>
					<Button
						className="min-h-0 px-3 py-2 text-xs shadow-none"
						cursorIntent={blocked ? "progress" : undefined}
						disabled={blocked}
						onClick={actions.refreshArkpacks}
					>
						Refresh
					</Button>
				</div>
				{actions.busyAction === "import" ? (
					<p className="mt-3 text-sm text-accent">Validating package…</p>
				) : actions.busyAction === "remove" ? (
					<p className="mt-3 text-sm text-accent">Removing package…</p>
				) : actions.busyAction === "refresh" ? (
					<p className="mt-3 text-sm text-accent">Refreshing packages…</p>
				) : actions.busyAction === "open-directory" ? (
					<p className="mt-3 text-sm text-accent">Opening Arkpack folder…</p>
				) : null}
				{actions.actionError === undefined ? null : (
					<p className="mt-3 text-sm text-danger">{String(actions.actionError)}</p>
				)}
			</section>

			<section className="grid min-h-0 content-start gap-3 overflow-y-auto overscroll-contain">
				<ArkpackCatalogList
					blocked={blocked}
					state={actions.state}
					onRemove={actions.removeArkpack}
				/>
			</section>

			<footer className="flex justify-center pb-[env(safe-area-inset-bottom)]">
				<BackButton
					cursorIntent={blocked ? "progress" : undefined}
					disabled={blocked}
					onClick={actions.requestMainMenu}
				>
					{actions.exitPending ? "Returning…" : "Back"}
				</BackButton>
			</footer>
		</div>
	);
};
