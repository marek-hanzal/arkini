import type { WhenSchema } from "~/engine/when/schema/WhenSchema";
import { match } from "ts-pattern";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import {
	EditorBoardDistanceControl,
	EditorQueryScopeControl,
} from "~/ui/item/editor/EditorQueryControl";
import { EditorSelectorControl } from "~/ui/item/editor/EditorSelectorControl";

export const EditorWhenControl = ({
	onChange,
	value,
}: {
	readonly onChange: (when: WhenSchema.Type) => void;
	readonly value: WhenSchema.Type;
}) => (
	<div className="grid min-w-0 gap-3">
		<EditorChoiceControl
			label="Condition type"
			value={value.type}
			options={[
				{
					description: "Passes when the query finds any positive item quantity.",
					label: "Exists",
					value: "exists",
				},
				{
					description:
						"Passes only when the query finds exactly the configured total item quantity.",
					label: "Exact count",
					value: "count",
				},
				{
					description:
						"Passes when the query finds a total item quantity inside the configured inclusive range.",
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
		<div className="flex min-w-0 flex-wrap items-end gap-3">
			<div className="min-w-64 flex-1">
				<EditorSelectorControl
					value={value.query.selector}
					onChange={(selector) =>
						onChange({
							...value,
							query: {
								...value.query,
								selector,
							},
						})
					}
				/>
			</div>
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
						<div className="min-w-64">
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
						</div>
					),
				)
				.with(
					{
						type: "range",
					},
					(when) => (
						<div className="grid min-w-96 grid-cols-2 gap-3">
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
		<div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
			<EditorQueryScopeControl
				value={value.query}
				onChange={(query) =>
					onChange({
						...value,
						query,
					})
				}
			/>
			{value.query.scope !== "board" ? null : (
				<EditorBoardDistanceControl
					value={value.query}
					onChange={(query) =>
						onChange({
							...value,
							query,
						})
					}
				/>
			)}
		</div>
	</div>
);
