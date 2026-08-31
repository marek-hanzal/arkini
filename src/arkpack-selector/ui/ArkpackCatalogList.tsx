import { Play, Sparkles, Trash2 } from "lucide-react";
import { match } from "ts-pattern";

import type { ArkpackCatalog } from "~/arkpack-catalog/service/ArkpackCatalog";
import { DangerButton, PrimaryButtonLink } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";

interface ArkpackCatalogListProps {
	readonly blocked?: boolean;
	readonly state: ArkpackCatalog.State;
	readonly onOpenEditorFn: (packageId: string) => void;
	readonly onRemoveFn: (packageId: string) => void;
}

/** Exhaustively renders the current Arkpack catalog projection. */
export const ArkpackCatalogList = ({
	blocked = false,
	state,
	onOpenEditorFn,
	onRemoveFn,
}: ArkpackCatalogListProps) =>
	match(state)
		.with(
			{
				type: "loading",
			},
			() => <p className="text-sm text-muted">Reading local packages…</p>,
		)
		.with(
			{
				type: "failed",
			},
			({ error }) => (
				<p className="text-sm text-danger">Package catalog failed: {String(error)}</p>
			),
		)
		.with(
			{
				type: "ready",
			},
			({ arkpacks }) => (
				<div
					className="ak-list grid gap-2"
					data-ui="ArkpackCatalogList"
				>
					{arkpacks.map((arkpack) => (
						<article
							key={arkpack.packageId}
							data-ui="ArkpackCatalogRow"
							className="ak-list-row flex min-w-0 flex-col items-stretch justify-between gap-4 rounded-xl p-4 sm:flex-row sm:items-center"
						>
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<h2 className="truncate text-lg font-semibold">
										{arkpack.title}
									</h2>
									<span className="rounded-full bg-surface-raised px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
										{match(arkpack.provenance)
											.with(
												{
													type: "official",
												},
												() => "Official",
											)
											.with(
												{
													type: "community",
												},
												() => "Community",
											)
											.exhaustive()}
									</span>
									{arkpack.overridesBundled ? (
										<span className="rounded-full bg-accent/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-accent">
											User override
										</span>
									) : null}
								</div>
								<p className="mt-1 truncate text-xs text-subtle">
									{arkpack.filename ?? `${arkpack.packageId} · ${arkpack.arkini}`}
								</p>
							</div>
							<div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">
								{arkpack.source === "user" ? (
									<DangerButton
										className="min-h-0 px-3 py-2 text-xs shadow-none"
										cursorIntent={blocked ? "progress" : undefined}
										disabled={blocked}
										onClick={() => onRemoveFn(arkpack.packageId)}
									>
										<Trash2 className="mr-1.5 size-4" />
										{arkpack.overridesBundled ? "Remove override" : "Remove"}
									</DangerButton>
								) : null}
								<LinkButton
									className="inline-flex items-center gap-1.5 text-xs"
									cursorIntent={blocked ? "progress" : undefined}
									disabled={blocked}
									onClick={() => onOpenEditorFn(arkpack.packageId)}
								>
									<Sparkles className="size-4" />
									Editor
								</LinkButton>
								<PrimaryButtonLink
									to="/action/load-game/$packageId"
									preload={false}
									params={{
										packageId: arkpack.packageId,
									}}
									disabled={blocked}
									className="min-h-0 gap-1.5 px-3 py-2 text-xs shadow-none"
									cursorIntent={blocked ? "progress" : undefined}
								>
									<Play className="size-4" />
									Play
								</PrimaryButtonLink>
							</div>
						</article>
					))}
				</div>
			),
		)
		.exhaustive();
