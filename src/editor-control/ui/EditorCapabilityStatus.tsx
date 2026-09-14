import type { LucideIcon } from "lucide-react";

import { PrimaryButton } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";

interface EditorCapabilityStatusProps {
	readonly actionLabel: string;
	readonly dataUi?: string;
	readonly icon: LucideIcon;
	readonly onEnableFn: () => void;
	readonly size?: "normal" | "large";
	readonly summary?: string;
	readonly title: string;
}

/** Explains one disabled editor capability before atomically creating its form subtree. */
export const EditorCapabilityStatus = ({
	actionLabel,
	dataUi,
	icon,
	onEnableFn,
	size = "normal",
	summary,
	title,
}: EditorCapabilityStatusProps) => (
	<Status
		action={<PrimaryButton onClick={onEnableFn}>{actionLabel}</PrimaryButton>}
		dataUi={dataUi}
		icon={icon}
		size={size}
		description={summary}
		title={title}
		variant="flat"
	/>
);
