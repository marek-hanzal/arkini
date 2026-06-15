import { useSuspenseQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { cn } from "~/shared/cn";
import { useHardResetAction } from "~/shared/hook/useHardResetAction";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { StatusPill } from "~/shared/ui/StatusPill";
import { hardResetBrowserStorage } from "~/shared/util/hardResetBrowserStorage";
import { logResetError } from "~/shared/util/logResetError";
import { reloadWindow } from "~/shared/util/reloadWindow";
import { databaseStatusQueryOptions } from "~/v0/database/query/databaseStatusQueryOptions";

export namespace DatabaseSheet {
	export interface Props {
		onClose(): void;
	}
}

export const DatabaseSheet: FC<DatabaseSheet.Props> = ({ onClose }) => {
	const { data: status } = useSuspenseQuery(databaseStatusQueryOptions());
	const reset = useHardResetAction({
		reset: hardResetBrowserStorage,
		onSuccess: reloadWindow,
		onError: logResetError,
	});
	const isolated = window.crossOriginIsolated;

	return (
		<section className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain">
			<SheetHeader
				eyebrow="System"
				description="Local database"
				onClose={onClose}
			/>
			<div className="p-4 pt-1">
				<section className="w-full rounded-md border border-slate-800 bg-slate-900/60 p-3 shadow-lg shadow-slate-950/25">
					<div className="flex h-full flex-wrap items-center gap-4">
						<div className="min-w-40">
							<p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-emerald-300">
								SQLite / OPFS
							</p>
							<h2 className="mt-1 text-base font-semibold text-white">Local save</h2>
							<span
								className={cn(
									"mt-2 inline-flex rounded-sm px-2 py-1 text-xs font-semibold",
									isolated
										? "bg-emerald-400/10 text-emerald-200"
										: "bg-amber-400/10 text-amber-200",
								)}
							>
								{isolated ? "isolated" : "headers missing"}
							</span>
						</div>

						<div className="grid min-w-64 flex-1 grid-cols-2 gap-2">
							<StatusPill
								label="DB"
								value={status.databasePath}
							/>
							<StatusPill
								label="Sync"
								value={status.gameConfigHash}
							/>
							<StatusPill
								label="Items"
								value={String(status.itemCount)}
							/>
							<StatusPill
								label="Prod"
								value={String(status.producerCount)}
							/>
						</div>

						<div className="min-w-40">
							<button
								type="button"
								disabled={reset.pending}
								onClick={() => void reset.run()}
								className="w-full rounded-md border border-red-300/45 bg-red-300 px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-wait disabled:opacity-60"
							>
								{reset.pending ? "Dropping OPFS storage…" : "Hard reset DB"}
							</button>
							{reset.failed ? (
								<p className="mt-3 text-sm text-red-100">
									Reset failed. Check the console.
								</p>
							) : null}
						</div>
					</div>
				</section>
			</div>
		</section>
	);
};
