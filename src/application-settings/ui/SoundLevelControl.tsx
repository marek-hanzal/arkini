import type { ChangeEventHandler } from "react";

export const SoundLevelControl = ({
	label,
	value,
	onChangeFn,
}: {
	readonly label: string;
	readonly value: number;
	readonly onChangeFn: (value: number) => void;
}) => {
	const onChange: ChangeEventHandler<HTMLInputElement> = (event) =>
		onChangeFn(event.currentTarget.valueAsNumber);
	return (
		<label
			className="grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-3"
			data-ui="SoundLevelControl"
		>
			<span className="text-sm font-medium text-foreground">{label}</span>
			<input
				type="range"
				min={0}
				max={100}
				step={1}
				value={value}
				onChange={onChange}
				className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
				style={{
					background: `linear-gradient(to right, var(--color-accent) ${value}%, var(--color-line) ${value}%)`,
				}}
			/>
			<output className="text-right text-sm tabular-nums text-muted">{value}</output>
		</label>
	);
};
