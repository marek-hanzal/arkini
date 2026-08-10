import { match } from "ts-pattern";

import type { EditorWhen } from "~/bridge/item/editor/EditorItemModel";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorQueryControl } from "~/ui/item/editor/EditorQueryControl";

export const EditorWhenControl = ({
	onChange,
	value,
}: {
	readonly onChange: (when: EditorWhen) => void;
	readonly value: EditorWhen;
}) => (
	<div className="grid grid-cols-2 gap-[var(--ak-panel-padding)]">
		<div className="grid min-w-0 content-start gap-3">
			<EditorChoiceControl
				label="Condition type"
				value={value.type}
				options={[
					{
						label: "Exists",
						value: "exists",
					},
					{
						label: "Exact count",
						value: "count",
					},
					{
						label: "Count range",
						value: "range",
					},
				]}
				onChange={(type) =>
					onChange(
						type === "exists"
							? {
									type,
									query: value.query,
								}
							: type === "count"
								? {
										type,
										query: value.query,
										count: 1,
									}
								: {
										type,
										query: value.query,
										min: 1,
										max: 1,
									},
					)
				}
			/>
			<EditorQueryControl
				value={value.query}
				onChange={(query) =>
					onChange({
						...value,
						query,
					})
				}
			/>
		</div>
		<div className="grid min-w-0 content-start gap-3">
			{match(value)
				.with(
					{
						type: "exists",
					},
					() => null,
				)
				.with(
					{
						type: "count",
					},
					(when) => (
						<EditorNumberControl
							label="Exact count"
							value={when.count}
							min={0}
							onChange={(count) =>
								onChange({
									...when,
									count,
								})
							}
						/>
					),
				)
				.with(
					{
						type: "range",
					},
					(when) => (
						<div className="grid grid-cols-2 gap-3">
							<EditorNumberControl
								label="Minimum count"
								value={when.min}
								min={0}
								onChange={(min) =>
									onChange({
										...when,
										min,
									})
								}
							/>
							<EditorNumberControl
								label="Maximum count"
								value={when.max}
								min={when.min}
								onChange={(max) =>
									onChange({
										...when,
										max,
									})
								}
							/>
						</div>
					),
				)
				.exhaustive()}
		</div>
	</div>
);
