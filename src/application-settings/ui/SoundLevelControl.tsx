import type { MouseEvent, MouseEventHandler } from "react";

import { readDataUiFn } from "~/ui/fn/readDataUiFn";

export const SoundLevelControl = ({
	label,
	value,
	onChangeFn,
}: {
	readonly label: string;
	readonly value: number;
	readonly onChangeFn: (value: number) => void;
}) => {
	const updateVolumeFn = (event: MouseEvent<HTMLButtonElement>) => {
		const bounds = event.currentTarget.getBoundingClientRect();
		const progress = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
		onChangeFn(Math.round(progress * 100));
	};
	const onMouseMove: MouseEventHandler<HTMLButtonElement> = (event) => {
		if ((event.buttons & 1) === 1) updateVolumeFn(event);
	};
	return (
		<button
			type="button"
			className="ak-list-row ak-list-row-interactive relative grid h-9 w-full cursor-pointer grid-cols-[minmax(0,1fr)_3rem] items-center overflow-hidden px-3 text-left"
			onMouseDown={updateVolumeFn}
			onMouseMove={onMouseMove}
			{...readDataUiFn({
				dataUi: "SoundLevelControl",
				state: {
					label,
					value,
				},
			})}
		>
			<span
				className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-[var(--ak-list-row-active-progress-surface)]"
				data-ui="SoundLevelProgress"
				style={{
					width: `${value}%`,
				}}
			/>
			<span className="relative z-10 text-sm font-medium text-foreground">{label}</span>
			<output className="relative z-10 text-right text-sm tabular-nums text-muted">
				{value}
			</output>
		</button>
	);
};
