export namespace SettingsSegmentedChoice {
	export interface Props<Value extends string> {
		readonly options: ReadonlyArray<{
			readonly value: Value;
			readonly label: string;
		}>;
		readonly selected: Value;
		readonly pending: boolean;
		readonly name: string;
		readonly ariaLabel: string;
		readonly dataUi: string;
		readonly onChange: (value: Value) => void;
	}
}

/** Settings-only segmented choice; its owner supplies the authoritative selection. */
export const SettingsSegmentedChoice = <Value extends string>({
	options,
	selected,
	pending,
	name,
	ariaLabel,
	dataUi,
	onChange,
}: SettingsSegmentedChoice.Props<Value>) => (
	<div
		className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-raised/65 p-1"
		role="radiogroup"
		aria-label={ariaLabel}
		data-ui={dataUi}
	>
		{options.map((option) => {
			const optionSelected = selected === option.value;
			return (
				<label
					key={option.value}
					className={`relative rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition-colors ${
						pending
							? optionSelected
								? "cursor-progress bg-accent text-accent-contrast opacity-60"
								: "cursor-progress text-muted opacity-60"
							: optionSelected
								? "cursor-pointer bg-accent text-accent-contrast hover:bg-accent-hover"
								: "cursor-pointer text-muted hover:bg-surface"
					}`}
					data-selected={optionSelected ? "true" : "false"}
					data-pending={pending ? "true" : "false"}
				>
					<input
						type="radio"
						name={name}
						value={option.value}
						checked={optionSelected}
						className="sr-only"
						onChange={() => onChange(option.value)}
					/>
					{option.label}
				</label>
			);
		})}
	</div>
);
