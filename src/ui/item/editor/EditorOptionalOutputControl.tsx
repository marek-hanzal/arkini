import type { EditorOutput } from "~/bridge/editor/EditorItemModel";
import { createEditorOutputDraft } from "~/bridge/editor/createEditorItemDraft";
import { Button } from "~/ui/button/Button";
import { EditorOutputControl } from "~/ui/item/editor/EditorOutputControl";

export interface EditorOptionalOutputControlProps {
	readonly addLabel: string;
	readonly onChange: (output: EditorOutput | undefined) => void;
	readonly removeLabel: string;
	readonly value: EditorOutput | undefined;
}

/** Adds, edits or removes one optional canonical output through the shared output editor. */
export const EditorOptionalOutputControl = ({
	addLabel,
	onChange,
	removeLabel,
	value,
}: EditorOptionalOutputControlProps) =>
	value === undefined ? (
		<Button
			className="justify-self-start"
			onClick={() => onChange(createEditorOutputDraft())}
		>
			{addLabel}
		</Button>
	) : (
		<div className="grid gap-3 border-t border-line pt-4">
			<EditorOutputControl
				value={value}
				onChange={onChange}
			/>
			<Button
				className="justify-self-end"
				onClick={() => onChange(undefined)}
			>
				{removeLabel}
			</Button>
		</div>
	);
