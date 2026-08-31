import { AnimatePresence, motion } from "motion/react";

import { JobStatusEnumSchema } from "~/production-job/schema/JobStatusEnumSchema";
import { itemDetailFadeMotion } from "~/item-detail-frame/ui/ItemDetailMotion";

/** Renders the shared runtime value used by Lines and Queue cards. */
export const ProductionJobRuntime = ({
	dataUi,
	jobStatus,
	runtime,
}: {
	readonly dataUi: string;
	readonly jobStatus: JobStatusEnumSchema.Type | "idle";
	readonly runtime: {
		readonly value: string;
		readonly detail: string;
	};
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
