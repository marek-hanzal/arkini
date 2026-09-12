import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import type { LucideIcon } from "lucide-react";
import type { OptionalCapability } from "~/item-authoring/type/Section";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { PrimaryButtonLink } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";

/** Opens the capability form with explicit enable intent, leaving persistence to Save. */
export const DisabledCapabilityDetail = ({
	actionLabel,
	capability,
	description,
	icon,
	itemUid,
	title,
}: {
	readonly actionLabel: string;
	readonly capability: OptionalCapability;
	readonly description: string;
	readonly icon: LucideIcon;
	readonly itemUid: string;
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
						sectionId: capability,
					}}
					search={{
						enable: capability,
					}}
				>
					{actionLabel}
				</PrimaryButtonLink>
			}
			icon={icon}
			title={
				<span className="inline-flex items-center gap-1.5">
					{title}
					<EditorInfoTooltip content={description} />
				</span>
			}
			variant="flat"
		/>
	);
};
