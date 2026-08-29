import type { LucideIcon } from "lucide-react";

import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorOutputControl } from "~/ui/item/editor/EditorOutputControl";

export interface EditorOptionalOutputControlProps {
	readonly addLabel: string;
	readonly emptyDescription: string;
	readonly emptyIcon: LucideIcon;
	readonly emptyTitle: string;
	readonly onChange: (output: OutputSchema.Type | undefined) => void;
	readonly value: OutputSchema.Type | undefined;
}

/** Adds, edits or removes one optional canonical output through the shared output editor. */
export const EditorOptionalOutputControl = ({
	addLabel,
	emptyDescription,
	emptyIcon,
	emptyTitle,
	onChange,
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
		<div className="grid gap-3">
			<EditorOutputControl
				value={value}
				onChange={onChange}
			/>
		</div>
	);
