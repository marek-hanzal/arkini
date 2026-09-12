import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import type { LucideIcon } from "lucide-react";

import { PrimaryButton } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";

interface EditorCapabilityStatusProps {
	readonly actionLabel: string;
	readonly dataUi?: string;
	readonly description?: string;
	readonly icon: LucideIcon;
	readonly onEnableFn: () => void;
	readonly title: string;
}

/** Explains one disabled editor capability before atomically creating its form subtree. */
export const EditorCapabilityStatus = ({
	actionLabel,
	dataUi,
	description,
	icon,
	onEnableFn,
	title,
}: EditorCapabilityStatusProps) => (
	<Status
		action={<PrimaryButton onClick={onEnableFn}>{actionLabel}</PrimaryButton>}
		dataUi={dataUi}
		icon={icon}
		title={
			<span className="inline-flex items-center gap-1.5">
				{title}
				{description === undefined ? null : <EditorInfoTooltip content={description} />}
			</span>
		}
		variant="flat"
	/>
);
