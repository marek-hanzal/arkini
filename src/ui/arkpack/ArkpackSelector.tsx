import { ArkpackCatalogList } from "~/ui/arkpack/ArkpackCatalogList";
import { useArkpackSelectorActions } from "~/ui/arkpack/useArkpackSelectorActions";
import { BackButton } from "~/ui/button/BackButton";
import { Button } from "~/ui/button/Button";
import { LinkButton } from "~/ui/button/LinkButton";

/** Selects a bundled or user-owned game package without uploading it anywhere. */
export const ArkpackSelector = () => {
	const actions = useArkpackSelectorActions();
	const blocked = actions.blocked;

	return (
		<div
			className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-[var(--ak-viewport-gap)]"
			data-ui="ArkpackSelector"
		>
			<header>
				<div className="flex items-center justify-between gap-4">
					<p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
						Arkpacks
					</p>
					<div className="flex flex-wrap items-center justify-end gap-4 text-sm">
						<LinkButton
							disabled={blocked}
							cursorIntent={blocked ? "progress" : undefined}
							className="inline-flex items-center gap-1.5"
							onClick={actions.openArkpackDirectory}
						>
							<span className="icon-[lucide--folder-open] size-4" />
							Open Arkpack folder
						</LinkButton>
						<LinkButton
							disabled={blocked}
							cursorIntent={blocked ? "progress" : undefined}
							className="inline-flex items-center gap-1.5"
							onClick={actions.refreshArkpacks}
						>
							<span className="icon-[lucide--refresh-cw] size-4" />
							Refresh
						</LinkButton>
					</div>
				</div>
				<h1
					id="arkpack-selector-title"
					className="mt-2 text-[clamp(1.25rem,4cqmin,1.875rem)] font-semibold"
				>
					Choose a game package
				</h1>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
					User arkpacks stay on this device. Every package is validated before it can run.
				</p>
				{actions.busyAction === "remove" ? (
					<p className="mt-3 text-sm text-accent">Removing package…</p>
				) : actions.busyAction === "open-directory" ? (
					<p className="mt-3 text-sm text-accent">Opening Arkpack folder…</p>
				) : null}
				{actions.actionError === undefined ? null : (
					<p className="mt-3 text-sm text-danger">{String(actions.actionError)}</p>
				)}
			</header>

			<section className="ak-list grid min-h-0 content-start gap-2 overflow-y-auto overscroll-contain">
				<input
					ref={actions.inputRef}
					type="file"
					accept=".arkpack,application/octet-stream"
					className="hidden"
					disabled={blocked}
					onChange={(event) => void actions.upload(event.currentTarget.files?.[0])}
				/>
				<Button
					className="ak-list-row ak-list-row-interactive min-h-0 min-w-0 justify-start gap-4 rounded-xl p-4 text-left shadow-none"
					cursorIntent={blocked ? "progress" : undefined}
					disabled={blocked}
					onClick={() => actions.inputRef.current?.click()}
				>
					<span className="icon-[lucide--package-open] size-8 shrink-0 text-accent" />
					<span className="min-w-0">
						<span className="block text-lg font-semibold">
							{actions.busyAction === "import" ? "Importing Arkpack…" : "Import Arkpack"}
						</span>
						<span className="mt-1 block text-xs font-normal text-subtle">
							Choose an existing .arkpack file
						</span>
					</span>
				</Button>
				<ArkpackCatalogList
					blocked={blocked}
					state={actions.state}
					onOpenEditor={actions.openArkpackInEditor}
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
