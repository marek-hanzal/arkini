import type { EditorOutput } from "~/bridge/item/editor/EditorItemModel";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorOutputControl } from "~/ui/item/editor/EditorOutputControl";

export interface EditorOptionalOutputControlProps {
	readonly addLabel: string;
	readonly emptyDescription: string;
	readonly emptyIcon: string;
	readonly emptyTitle: string;
	readonly onChange: (output: EditorOutput | undefined) => void;
	readonly separated?: boolean;
	readonly value: EditorOutput | undefined;
}

/** Adds, edits or removes one optional canonical output through the shared output editor. */
export const EditorOptionalOutputControl = ({
	addLabel,
	emptyDescription,
	emptyIcon,
	emptyTitle,
	onChange,
	separated = true,
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
		<div className={`grid gap-3 ${separated ? "border-t border-line pt-4" : ""}`}>
			<EditorOutputControl
				value={value}
				onChange={onChange}
			/>
		</div>
	);
