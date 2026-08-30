import type { LucideIcon } from "lucide-react";

import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorOutputControl } from "~/production-line-authoring/ui/EditorOutputControl";
import { EditorProductionDraftDefaults } from "~/production-line-authoring/ui/EditorProductionDraftDefaults";

interface EditorOptionalOutputControlProps {
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
			onEnable={() => onChange(structuredClone(EditorProductionDraftDefaults.output))}
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
