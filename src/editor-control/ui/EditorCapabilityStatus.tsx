import type { LucideIcon } from "lucide-react";

import { PrimaryButton } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";

interface EditorCapabilityStatusProps {
	readonly actionLabel: string;
	readonly dataUi?: string;
	readonly description: string;
	readonly icon: LucideIcon;
	readonly onEnable: () => void;
	readonly title: string;
}

/** Explains one disabled editor capability before atomically creating its form subtree. */
export const EditorCapabilityStatus = ({
	actionLabel,
	dataUi,
	description,
	icon,
	onEnable,
	title,
}: EditorCapabilityStatusProps) => (
	<Status
		action={<PrimaryButton onClick={onEnable}>{actionLabel}</PrimaryButton>}
		dataUi={dataUi}
		description={description}
		icon={icon}
		title={title}
		variant="flat"
	/>
);
