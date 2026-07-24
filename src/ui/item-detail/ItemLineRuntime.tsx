import { match } from "ts-pattern";

import { JobStatusEnumSchema } from "~/bridge/job/JobStatusEnumSchema";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";

/** Renders the effective or active runtime presentation for one visible product line. */
export const ItemLineRuntime = ({ line }: { readonly line: ItemDetailLines.Line }) => {
	const formatDuration = (milliseconds: number) => {
		if (milliseconds === 0) return "Immediate";
		const seconds = milliseconds / 1_000;
		if (seconds < 60) {
			return Number.isInteger(seconds) ? `${seconds} s` : `${seconds.toFixed(1)} s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = Math.round(seconds % 60);
		return remainingSeconds === 0 ? `${minutes} min` : `${minutes} min ${remainingSeconds} s`;
	};
	const activeJob = line.activeJob;
	const runtime =
		activeJob === undefined
			? {
					value: formatDuration(line.effectiveRuntimeMs),
					detail:
						line.baseRuntimeMs === line.effectiveRuntimeMs
							? "Per cycle"
							: `Base ${formatDuration(line.baseRuntimeMs)}`,
				}
			: match(activeJob.status)
					.with(JobStatusEnumSchema.enum.Running, () => ({
						value: formatDuration(activeJob.remainingMs),
						detail: `Remaining of ${formatDuration(activeJob.durationMs)}`,
					}))
					.with(JobStatusEnumSchema.enum.Paused, () => ({
						value: formatDuration(activeJob.remainingMs),
						detail: `Paused · of ${formatDuration(activeJob.durationMs)}`,
					}))
					.with(JobStatusEnumSchema.enum.AwaitingOutput, () => ({
						value: "Complete",
						detail: "Awaiting output",
					}))
					.exhaustive();
	return (
		<div
			className="grid min-w-32 grid-rows-[1rem_1.5rem_1rem] text-right"
			data-ui="TileLineRuntime"
			data-job-status={activeJob?.status ?? "idle"}
		>
			<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Runtime</p>
			<p
				className="self-center font-semibold tabular-nums text-foreground"
				data-ui="TileLineRuntimeValue"
			>
				{runtime.value}
			</p>
			<p
				className="self-end text-xs tabular-nums text-muted"
				data-ui="TileLineRuntimeDetail"
			>
				{runtime.detail}
			</p>
		</div>
	);
};
