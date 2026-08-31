import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen, PackageOpen, RefreshCw } from "lucide-react";

import { ArkpackCatalogList } from "~/arkpack-selector/ui/ArkpackCatalogList";
import { useArkpackSelectorActions } from "~/arkpack-selector/ui/useArkpackSelectorActions";
import { BackButton } from "~/ui/ui/BackButton";
import { Button } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { LauncherPageLayout } from "~/launcher/ui/LauncherPageLayout";

export const Route = createFileRoute("/_launcher/arkpacks")({
	component: () => {
		const actions = useArkpackSelectorActions();
		const blocked = actions.blocked;

		return (
			<LauncherPageLayout page="arkpacks">
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
									<FolderOpen className="size-4" />
									Open Arkpack folder
								</LinkButton>
								<LinkButton
									disabled={blocked}
									cursorIntent={blocked ? "progress" : undefined}
									className="inline-flex items-center gap-1.5"
									onClick={actions.refreshArkpacks}
								>
									<RefreshCw className="size-4" />
									Refresh
								</LinkButton>
							</div>
						</div>
						<h1 className="mt-2 text-[clamp(1.25rem,4cqmin,1.875rem)] font-semibold">
							Choose a game package
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
							Editor imports an Arkpack into a separate project. Changes aren’t
							live—build and install the project to update the Arkpack.
						</p>
						{actions.actionError === undefined ? null : (
							<p className="mt-3 text-sm text-danger">
								{String(actions.actionError)}
							</p>
						)}
					</header>

					<section className="ak-list grid min-h-0 content-start gap-2 overflow-y-auto overscroll-contain">
						<input
							ref={actions.inputRef}
							type="file"
							accept=".arkpack,application/octet-stream"
							className="hidden"
							disabled={blocked}
							onChange={(event) =>
								void actions.upload(event.currentTarget.files?.[0])
							}
						/>
						<Button
							className="ak-list-row ak-list-row-interactive min-h-0 min-w-0 justify-start gap-4 rounded-xl p-4 text-left shadow-none"
							cursorIntent={blocked ? "progress" : undefined}
							disabled={blocked}
							onClick={() => actions.inputRef.current?.click()}
						>
							<PackageOpen className="size-8 shrink-0 text-accent" />
							<span className="min-w-0">
								<span className="block text-lg font-semibold">Import Arkpack</span>
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
							Back
						</BackButton>
					</footer>
				</div>
			</LauncherPageLayout>
		);
	},
});
