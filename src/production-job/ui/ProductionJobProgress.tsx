interface ProductionJobProgressRuntime {
	readonly durationMs: number;
	readonly remainingMs: number;
}

const readProgressFn = ({ durationMs, remainingMs }: ProductionJobProgressRuntime) =>
	durationMs === 0 ? 1 : Math.max(0, Math.min(1, (durationMs - remainingMs) / durationMs));

/** Renders the canonical active-job progress surface shared by Lines and Queue. */
export const ProductionJobProgress = ({
	runtime,
}: {
	readonly runtime: ProductionJobProgressRuntime;
}) => {
	const progress = readProgressFn(runtime);
	return (
		<div
			className="h-full overflow-hidden rounded-r-[inherit]"
			data-ui="ProductionJobProgress"
		>
			<div
				className="h-full bg-[var(--ak-list-row-active-progress-surface)] transition-[width] duration-200 ease-linear"
				data-ui="ProductionJobProgressFill"
				style={{
					width: `${progress * 100}%`,
				}}
			/>
		</div>
	);
};
