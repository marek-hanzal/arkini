export const BadgeCount = ({
	count,
	dataUi,
	label,
}: {
	readonly count: number;
	readonly dataUi: string;
	readonly label?: string;
}) => (
	<span
		className="min-w-5 rounded-full bg-warning/20 px-1.5 py-0.5 text-center text-[0.6875rem] font-semibold tabular-nums text-foreground"
		data-ui={dataUi}
	>
		{label === undefined ? count : `${label}${count > 1 ? ` ×${count}` : ""}`}
	</span>
);
