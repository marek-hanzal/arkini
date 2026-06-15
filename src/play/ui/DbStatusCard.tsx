import type { FC } from "react";
import { useDbStatusCard } from "~/play/hook/useDbStatusCard";
import { HardResetButton } from "~/play/ui/HardResetButton";
import { StatusPill } from "~/play/ui/StatusPill";
import { cn } from "~/shared/cn";

export namespace DbStatusCard {
	export interface Props {}
}

export const DbStatusCard: FC<DbStatusCard.Props> = () => {
	const card = useDbStatusCard();

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
							card.isolated
								? "bg-emerald-400/10 text-emerald-200"
								: "bg-amber-400/10 text-amber-200",
						)}
					>
						{card.isolated ? "isolated" : "headers missing"}
					</span>
				</div>

				<div className="grid min-w-64 flex-1 grid-cols-2 gap-2">
					<StatusPill
						label="DB"
						value={card.databasePath}
					/>
					<StatusPill
						label="Sync"
						value={card.gameConfigHash}
					/>
					<StatusPill
						label="Items"
						value={card.itemCount}
					/>
					<StatusPill
						label="Prod"
						value={card.producerCount}
					/>
				</div>

				<div className="min-w-40">
					<HardResetButton label="Hard reset DB" />
				</div>
			</div>
		</section>
	);
};
