import type { LucideIcon } from "lucide-react";

import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { OutputControl } from "~/production-authoring/ui/OutputControl";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";

interface OptionalOutputControlProps {
	readonly addLabel: string;
	readonly emptyDescription: string;
	readonly emptyIcon: LucideIcon;
	readonly emptyTitle: string;
	readonly onChangeFn: (output: OutputSchema.Type | undefined) => void;
	readonly value: OutputSchema.Type | undefined;
}

/** Adds, edits or removes one optional canonical output through the shared output editor. */
export const OptionalOutputControl = ({
	addLabel,
	emptyDescription,
	emptyIcon,
	emptyTitle,
	onChangeFn,
	value,
}: OptionalOutputControlProps) =>
	value === undefined ? (
		<EditorCapabilityStatus
			actionLabel={addLabel}
			description={emptyDescription}
			icon={emptyIcon}
			onEnableFn={() => onChangeFn(structuredClone(DraftDefaults.output))}
			title={emptyTitle}
		/>
	) : (
		<div className="grid gap-3">
			<OutputControl
				value={value}
				onChangeFn={onChangeFn}
			/>
		</div>
	);
