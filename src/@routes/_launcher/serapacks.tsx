import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen, PackageOpen, RefreshCw } from "lucide-react";

import { SerapackCatalogList } from "~/serapack-selector/ui/SerapackCatalogList";
import { useSerapackSelectorActions } from "~/serapack-selector/ui/useSerapackSelectorActions";
import { BackButton } from "~/ui/ui/BackButton";
import { Button } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { LauncherPageLayout } from "~/launcher/ui/LauncherPageLayout";

export const Route = createFileRoute("/_launcher/serapacks")({
	component: () => {
		const actions = useSerapackSelectorActions();
		const blocked = actions.blocked;

		return (
			<LauncherPageLayout page="serapacks">
				<div
					className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-[var(--ak-viewport-gap)]"
					data-ui="SerapackSelector"
				>
					<header>
						<div className="flex items-center justify-between gap-4">
							<p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
								Serapacks
							</p>
							<div className="flex flex-wrap items-center justify-end gap-4 text-sm">
								<LinkButton
									disabled={blocked}
									cursorIntent={blocked ? "progress" : undefined}
									className="inline-flex items-center gap-1.5"
									onClick={actions.openSerapackDirectoryFn}
								>
									<FolderOpen className="size-4" />
									Open Serapack folder
								</LinkButton>
								<LinkButton
									disabled={blocked}
									cursorIntent={blocked ? "progress" : undefined}
									className="inline-flex items-center gap-1.5"
									onClick={actions.refreshSerapacksFn}
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
							Editor imports an Serapack into a separate project. Changes aren’t
							live—build and install the project to update the Serapack.
						</p>
						{actions.actionError === undefined ? null : (
							<p className="mt-3 text-sm text-danger">
								{String(actions.actionError)}
							</p>
						)}
					</header>

					<section className="ak-list grid min-h-0 content-start gap-2 overflow-y-auto overscroll-contain">
						<Button
							className="ak-list-row ak-list-row-interactive min-h-0 min-w-0 justify-start gap-4 p-4 text-left"
							cursorIntent={blocked ? "progress" : undefined}
							disabled={blocked}
							onClick={() => void actions.uploadFn()}
						>
							<PackageOpen className="size-8 shrink-0 text-accent" />
							<span className="min-w-0">
								<span className="block text-lg font-semibold">Import Serapack</span>
								<span className="mt-1 block text-xs font-normal text-subtle">
									Choose an existing .serapack file
								</span>
							</span>
						</Button>
						<SerapackCatalogList
							blocked={blocked}
							state={actions.state}
							onOpenEditorFn={actions.openSerapackInEditorFn}
							onRemoveFn={actions.removeSerapackFn}
						/>
					</section>

					<footer className="flex justify-center pb-[env(safe-area-inset-bottom)]">
						<BackButton
							cursorIntent={blocked ? "progress" : undefined}
							disabled={blocked}
							onClick={actions.requestMainMenuFn}
						>
							Back
						</BackButton>
					</footer>
				</div>
			</LauncherPageLayout>
		);
	},
});
