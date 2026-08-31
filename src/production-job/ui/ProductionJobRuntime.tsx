import { AnimatePresence, motion } from "motion/react";
import { match } from "ts-pattern";

import { JobStatusEnumSchema } from "~/production-job/schema/JobStatusEnumSchema";
import { itemDetailFadeMotion } from "~/item-detail-frame/ui/ItemDetailMotion";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";

interface ActiveJobRuntime {
	readonly durationMs: number;
	readonly remainingMs: number;
	readonly status: JobStatusEnumSchema.Type;
}

interface IdleJobRuntime {
	readonly baseDurationMs: number;
	readonly durationMs: number;
	readonly status: "idle";
}

type JobRuntime = ActiveJobRuntime | IdleJobRuntime;

const readRuntimeFn = (runtime: JobRuntime) => {
	if (runtime.status === "idle")
		return {
			value: formatDurationFn(runtime.durationMs),
			detail:
				runtime.baseDurationMs === runtime.durationMs
					? "Per cycle"
					: `Base ${formatDurationFn(runtime.baseDurationMs)}`,
		};

	const remaining = formatDurationFn(runtime.remainingMs);
	const duration = formatDurationFn(runtime.durationMs);
	return match(runtime.status)
		.with(JobStatusEnumSchema.enum.Running, () => ({
			value: remaining,
			detail: `Remaining of ${duration}`,
		}))
		.with(JobStatusEnumSchema.enum.Paused, () => ({
			value: remaining,
			detail: `Paused · of ${duration}`,
		}))
		.with(JobStatusEnumSchema.enum.AwaitingOutput, () => ({
			value: "Complete",
			detail: "Awaiting output",
		}))
		.exhaustive();
};

/** Renders the shared runtime value used by Lines and Queue cards. */
export const ProductionJobRuntime = ({
	dataUi,
	runtime,
}: {
	readonly dataUi: string;
	readonly runtime: JobRuntime;
}) => {
	const projection = readRuntimeFn(runtime);
	return (
		<div
			className="grid min-w-32 grid-rows-[1rem_1.5rem_1rem] text-right"
			data-ui={dataUi}
			data-job-status={runtime.status}
		>
			<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Runtime</p>
			<AnimatePresence
				initial={false}
				mode="popLayout"
			>
				<motion.div
					key={runtime.status}
					className="col-start-1 row-span-2 row-start-2 grid grid-rows-[1.5rem_1rem]"
					{...itemDetailFadeMotion}
				>
					<p
						className="self-center font-semibold tabular-nums text-foreground"
						data-ui={`${dataUi}Value`}
					>
						{projection.value}
					</p>
					<p
						className="self-end text-xs tabular-nums text-muted"
						data-ui={`${dataUi}Detail`}
					>
						{projection.detail}
					</p>
				</motion.div>
			</AnimatePresence>
		</div>
	);
};
