import type { EditorOutput } from "~/bridge/item/editor/EditorItemModel";
import { Button } from "~/ui/button/Button";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorOutputControl } from "~/ui/item/editor/EditorOutputControl";

export interface EditorOptionalOutputControlProps {
	readonly addLabel: string;
	readonly emptyDescription: string;
	readonly emptyIcon: string;
	readonly emptyTitle: string;
	readonly onChange: (output: EditorOutput | undefined) => void;
	readonly removeLabel: string;
	readonly value: EditorOutput | undefined;
}

/** Adds, edits or removes one optional canonical output through the shared output editor. */
export const EditorOptionalOutputControl = ({
	addLabel,
	emptyDescription,
	emptyIcon,
	emptyTitle,
	onChange,
	removeLabel,
	value,
}: EditorOptionalOutputControlProps) =>
	value === undefined ? (
		<EditorCapabilityStatus
			actionLabel={addLabel}
			description={emptyDescription}
			icon={emptyIcon}
			onEnable={() => onChange(structuredClone(EditorItemDraftDefaults.output))}
			title={emptyTitle}
		/>
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
