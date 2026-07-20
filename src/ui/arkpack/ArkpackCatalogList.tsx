import { match } from "ts-pattern";

import type { useArkpacks } from "~/bridge/arkpack/useArkpacks";
import { DangerButton, PrimaryButtonLink } from "~/ui/button/Button";

export namespace ArkpackCatalogList {
	export interface Props {
		readonly state: useArkpacks.State;
		readonly onRemove: (packageId: string) => void;
	}
}

/** Exhaustively renders the current Arkpack catalog projection. */
export const ArkpackCatalogList = ({ state, onRemove }: ArkpackCatalogList.Props) =>
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
			({ arkpacks }) =>
				arkpacks.map((arkpack) => (
					<article
						key={arkpack.packageId}
						className="flex min-w-0 flex-col items-stretch justify-between gap-4 rounded-2xl border border-line bg-surface/80 p-4 sm:flex-row sm:items-center"
					>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<h2 className="truncate text-lg font-semibold">{arkpack.title}</h2>
								<span className="rounded-full bg-surface-raised px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
									{arkpack.source === "built-in" ? "Official" : "Local"}
								</span>
							</div>
							<p className="mt-1 truncate text-xs text-subtle">
								{arkpack.filename ??
									`${arkpack.gameId} · config ${arkpack.configVersion}`}
							</p>
						</div>
						<div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">
							{arkpack.source === "imported" ? (
								<DangerButton
									className="min-h-0 px-3 py-2 text-xs shadow-none"
									onClick={() => onRemove(arkpack.packageId)}
								>
									Remove
								</DangerButton>
							) : null}
							<PrimaryButtonLink
								to="/action/load-game/$packageId"
								preload={false}
								params={{
									packageId: arkpack.packageId,
								}}
								className="min-h-0 px-4 py-2 text-sm shadow-none"
							>
								Play
							</PrimaryButtonLink>
						</div>
					</article>
				)),
		)
		.exhaustive();
