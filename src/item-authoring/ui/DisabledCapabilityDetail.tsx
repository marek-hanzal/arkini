import type { LucideIcon } from "lucide-react";
import type { OptionalCapability } from "~/item-authoring/type/Section";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { PrimaryButtonLink } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";

/** Opens the capability form with explicit enable intent, leaving persistence to Save. */
export const DisabledCapabilityDetail = ({
	actionLabel,
	capability,
	icon,
	itemUid,
	size = "normal",
	summary,
	title,
}: {
	readonly actionLabel: string;
	readonly capability: OptionalCapability;
	readonly icon: LucideIcon;
	readonly itemUid: string;
	readonly size?: "normal" | "large";
	readonly summary?: string;
	readonly title: string;
}) => {
	const project = useEditorProject();
	return (
		<Status
			action={
				<PrimaryButtonLink
					to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
					params={{
						projectId: project.projectId,
						itemUid,
						sectionId:
							capability === "units"
								? "identity"
								: capability === "clock"
									? "clock"
									: capability,
					}}
					search={{
						enable: capability,
					}}
				>
					{actionLabel}
				</PrimaryButtonLink>
			}
			icon={icon}
			size={size}
			description={summary}
			title={title}
			variant="flat"
		/>
	);
};
