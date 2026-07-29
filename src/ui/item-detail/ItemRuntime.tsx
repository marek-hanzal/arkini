import { AnimatePresence, motion } from "motion/react";
import { match } from "ts-pattern";

import { JobStatusEnumSchema } from "~/bridge/job/JobStatusEnumSchema";
import { itemDetailFadeMotion } from "~/ui/item-detail/ItemDetailMotion";

interface ActiveJobRuntime {
	readonly durationMs: number;
	readonly remainingMs: number;
	readonly status: JobStatusEnumSchema.Type;
}

export interface ItemRuntimeValue {
	readonly value: string;
	readonly detail: string;
}

export const formatItemDuration = (milliseconds: number) => {
	if (milliseconds === 0) return "Immediate";
	const seconds = milliseconds / 1_000;
	if (seconds < 60) {
		return Number.isInteger(seconds) ? `${seconds} s` : `${seconds.toFixed(1)} s`;
	}
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.round(seconds % 60);
	return remainingSeconds === 0 ? `${minutes} min` : `${minutes} min ${remainingSeconds} s`;
};

export const readActiveJobRuntime = (job: ActiveJobRuntime): ItemRuntimeValue =>
	match(job.status)
		.with(JobStatusEnumSchema.enum.Running, () => ({
			value: formatItemDuration(job.remainingMs),
			detail: `Remaining of ${formatItemDuration(job.durationMs)}`,
		}))
		.with(JobStatusEnumSchema.enum.Paused, () => ({
			value: formatItemDuration(job.remainingMs),
			detail: `Paused · of ${formatItemDuration(job.durationMs)}`,
		}))
		.with(JobStatusEnumSchema.enum.AwaitingOutput, () => ({
			value: "Complete",
			detail: "Awaiting output",
		}))
		.exhaustive();

/** Renders the shared runtime value used by Lines and Queue cards. */
export const ItemRuntime = ({
	dataUi,
	jobStatus,
	runtime,
}: {
	readonly dataUi: string;
	readonly jobStatus: JobStatusEnumSchema.Type | "idle";
	readonly runtime: ItemRuntimeValue;
}) => (
	<div
		className="grid min-w-32 grid-rows-[1rem_1.5rem_1rem] text-right"
		data-ui={dataUi}
		data-job-status={jobStatus}
	>
		<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Runtime</p>
		<AnimatePresence
			initial={false}
			mode="popLayout"
		>
			<motion.div
				key={jobStatus}
				className="col-start-1 row-span-2 row-start-2 grid grid-rows-[1.5rem_1rem]"
				{...itemDetailFadeMotion}
			>
				<p
					className="self-center font-semibold tabular-nums text-foreground"
					data-ui={`${dataUi}Value`}
				>
					{runtime.value}
				</p>
				<p
					className="self-end text-xs tabular-nums text-muted"
					data-ui={`${dataUi}Detail`}
				>
					{runtime.detail}
				</p>
			</motion.div>
		</AnimatePresence>
	</div>
);
