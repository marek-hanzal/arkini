import type { FC } from "react";
import { cn } from "~/shared/cn";
import { useArkiniDatabaseStatus } from "~/play/hook/useArkiniDatabaseStatus";
import { StatusPill } from "~/play/ui/StatusPill";
import { HardResetButton } from "~/play/ui/HardResetButton";

export namespace DbStatusCard {
	export interface Props {}
}

export const DbStatusCard: FC<DbStatusCard.Props> = () => {
	const status = useArkiniDatabaseStatus();
	const isolated = typeof window !== "undefined" && window.crossOriginIsolated === true;

	return (
		<section className="w-full rounded-md border border-slate-800 bg-slate-900/60 p-3 shadow-lg shadow-slate-950/25">
			<div className="flex h-full flex-wrap items-center gap-4">
				<div className="min-w-40">
					<p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-emerald-300">
						Local database
					</p>
					<h2 className="mt-1 text-base font-semibold text-white">SQLite / OPFS</h2>
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
						value={status.isSuccess ? status.data.databasePath : "arkini.sqlite3"}
					/>
					<StatusPill
						label="Sync"
						value={
							status.isSuccess ? status.data.gameConfigHash.slice(0, 10) : "pending"
						}
					/>
					<StatusPill
						label="Items"
						value={status.isSuccess ? String(status.data.itemCount) : "…"}
					/>
					<StatusPill
						label="Prod"
						value={status.isSuccess ? String(status.data.producerCount) : "…"}
					/>
				</div>

				<div className="min-w-40">
					<HardResetButton label="Hard reset DB" />
				</div>
			</div>

			{status.isError ? (
				<p className="mt-3 text-sm text-red-100">{(status.error as Error).message}</p>
			) : null}
		</section>
	);
};
