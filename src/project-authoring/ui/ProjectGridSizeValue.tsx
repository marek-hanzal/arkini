export const ProjectGridSizeValue = ({
	height,
	width,
}: {
	readonly height: number;
	readonly width: number;
}) => {
	const size =
		Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0
			? width * height
			: "—";
	return (
		<div className="grid content-start gap-1.5 text-sm">
			<span className="font-semibold text-foreground">Size</span>
			<output className="flex min-h-[var(--ak-control-min-height)] items-center rounded-lg border border-line bg-canvas/50 px-3 py-2 font-mono text-muted">
				{size}
			</output>
		</div>
	);
};
