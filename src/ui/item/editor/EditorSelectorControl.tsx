import { match } from "ts-pattern";

import type { EditorSelector } from "~/bridge/editor/EditorItemModel";
import { EditorChoiceControl, EditorTextControl } from "~/ui/form/EditorValueControls";
import { EditorItemReferenceControl } from "~/ui/item/editor/EditorItemReferenceControl";

export interface EditorSelectorControlProps {
	readonly onChange: (selector: EditorSelector) => void;
	readonly value: EditorSelector;
}

/** Edits an item-or-tag selector through its explicit discriminator. */
export const EditorSelectorControl = ({ onChange, value }: EditorSelectorControlProps) => (
	<div className="grid gap-3">
		<EditorChoiceControl
			label="Selector"
			value={value.type}
			options={[
				{
					label: "Item",
					value: "item",
				},
				{
					label: "Tag",
					value: "tag",
				},
			]}
			onChange={(type) =>
				onChange(
					type === "item"
						? {
								type,
								itemId: value.type === "item" ? value.itemId : "",
							}
						: {
								type,
								tag: value.type === "tag" ? value.tag : "",
							},
				)
			}
		/>
		{match(value)
			.with(
				{
					type: "item",
				},
				(selector) => (
					<EditorItemReferenceControl
						label="Selected item"
						value={selector.itemId}
						onChange={(itemId) =>
							onChange({
								...selector,
								itemId,
							})
						}
					/>
				),
			)
			.with(
				{
					type: "tag",
				},
				(selector) => (
					<EditorTextControl
						label="Selected tag"
						value={selector.tag}
						onChange={(tag) =>
							onChange({
								...selector,
								tag,
							})
						}
					/>
				),
			)
			.exhaustive()}
	</div>
);
