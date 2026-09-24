import type { LucideIcon } from "lucide-react";
import { Power } from "lucide-react";

import { PrimaryButton } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";
import { useSectionShortcuts } from "~/ui/ui/useSectionShortcuts";

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
}: EditorCapabilityStatusProps) => {
	useSectionShortcuts({
		options: [
			{
				shortcut: "e",
			},
		],
		onSelectFn: () => {
			if (document.querySelector('[data-ui="Overlay"], [data-ui$="Dialog"]') !== null) return;
			onEnableFn();
		},
	});
	return (
		<Status
			action={
				<PrimaryButton
					className="gap-1.5"
					onClick={onEnableFn}
				>
					<Power className="size-4" />
					{actionLabel}
				</PrimaryButton>
			}
			dataUi={dataUi}
			icon={icon}
			size={size}
			description={summary}
			title={title}
			variant="flat"
		/>
	);
};
