import { readDataUiFn } from "~/ui/fn/readDataUiFn";

interface SettingsSegmentedChoiceProps<Value extends string> {
	readonly options: ReadonlyArray<{
		readonly value: Value;
		readonly label: string;
	}>;
	readonly selected: Value;
	readonly pending: boolean;
	readonly dataUi: string;
	readonly onChangeFn: (value: Value) => void;
}

/** Settings-only segmented choice; its owner supplies the authoritative selection. */
export const SettingsSegmentedChoice = <Value extends string>({
	options,
	selected,
	pending,
	dataUi,
	onChangeFn,
}: SettingsSegmentedChoiceProps<Value>) => (
	<div
		className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-raised/65 p-1"
		data-ui={dataUi}
	>
		{options.map((option) => {
			const optionSelected = selected === option.value;
			return (
				<button
					key={option.value}
					className="ak-segmented-option relative cursor-pointer rounded-lg px-3 py-2.5 text-center text-sm font-semibold"
					disabled={pending}
					onClick={() => onChangeFn(option.value)}
					type="button"
					{...readDataUiFn({
						dataUi: "SettingsSegmentedChoiceOption",
						state: {
							pending,
							selected: optionSelected,
							value: option.value,
						},
					})}
				>
					{option.label}
				</button>
			);
		})}
	</div>
);
