import { Play, Sparkles, Trash2 } from "lucide-react";
import { match } from "ts-pattern";

import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";
import { PrimaryButtonLink } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";

interface SerapackCatalogListProps {
	readonly blocked?: boolean;
	readonly state: SerapackCatalog.State;
	readonly onOpenEditorFn: (packageId: string) => void;
	readonly onRemoveFn: (packageId: string) => void;
}

/** Exhaustively renders the current Serapack catalog projection. */
export const SerapackCatalogList = ({
	blocked = false,
	state,
	onOpenEditorFn,
	onRemoveFn,
}: SerapackCatalogListProps) =>
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
			({ serapacks }) => (
				<div
					className="ak-list grid gap-2"
					data-ui="SerapackCatalogList"
				>
					{serapacks.map((serapack) => (
						<article
							key={serapack.packageId}
							data-ui="SerapackCatalogRow"
							className="ak-list-row flex min-w-0 flex-col items-stretch justify-between gap-4 p-4 sm:flex-row sm:items-center"
						>
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<h2 className="truncate text-lg font-semibold">
										{serapack.title}
									</h2>
									<span className="rounded-full bg-surface-raised px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
										{match(serapack.provenance)
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
									{serapack.overridesBundled ? (
										<span className="rounded-full bg-accent/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-accent">
											User override
										</span>
									) : null}
								</div>
								<p className="mt-1 truncate text-xs text-subtle">
									{serapack.filename ??
										`${serapack.packageId} · ${serapack.serakki}`}
								</p>
							</div>
							<div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3 sm:shrink-0">
								{serapack.source === "user" ? (
									<LinkButton
										className="inline-flex items-center gap-1.5 text-xs"
										cursorIntent={blocked ? "progress" : undefined}
										disabled={blocked}
										onClick={() => onRemoveFn(serapack.packageId)}
									>
										<Trash2 className="size-4" />
										Remove
									</LinkButton>
								) : null}
								<LinkButton
									className="inline-flex items-center gap-1.5 text-xs"
									cursorIntent={blocked ? "progress" : undefined}
									disabled={blocked}
									onClick={() => onOpenEditorFn(serapack.packageId)}
								>
									<Sparkles className="size-4" />
									Editor
								</LinkButton>
								<PrimaryButtonLink
									to="/action/load-game/$packageId"
									preload={false}
									params={{
										packageId: serapack.packageId,
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
