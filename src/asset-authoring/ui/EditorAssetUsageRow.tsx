import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import type { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import { ProjectAvatarKeys } from "~/project-authoring/schema/ProjectFormSchema";
import type { Project } from "~/project-authoring/type/Project";
import { ButtonLink } from "~/ui/ui/Button";

/** Owns the common row behavior and destinations for one saved asset usage. */
export const EditorAssetUsageRow = ({
	dataUi,
	detail,
	leading,
	project,
	title,
	trailing,
	usage,
}: {
	readonly dataUi: string;
	readonly detail?: ReactNode;
	readonly leading?: ReactNode;
	readonly project: Project;
	readonly title?: ReactNode;
	readonly trailing?: ReactNode;
	readonly usage: readGameResourceUsagesFn.Usage;
}) => {
	const content = (
		<>
			{leading}
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-semibold">
					{title ?? usage.ownerLabel}
				</span>
				<span className="mt-1 block text-xs font-normal leading-5 text-muted">
					{detail ?? usage.roleLabel}
				</span>
			</span>
			{trailing}
			<ChevronRight className="size-5 shrink-0 text-subtle" />
		</>
	);
	const className =
		"ak-list-row ak-list-row-interactive flex min-h-0 min-w-0 items-center justify-start gap-4 rounded-xl border-0 p-4 text-left shadow-none";
	if (usage.owner === "item")
		return (
			<ButtonLink
				to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
				params={{
					itemUid: usage.ownerUid,
					projectId: project.projectId,
					sectionId: "artwork",
				}}
				className={className}
				data-ui={dataUi}
			>
				{content}
			</ButtonLink>
		);

	const role = usage.path[1];
	const roleIndex = ProjectAvatarKeys.findIndex((key) => key === role);
	const avatarIndex =
		roleIndex < 0
			? undefined
			: ProjectAvatarKeys.slice(0, roleIndex + 1).filter(
					(key) => project.config.resources[key] !== undefined,
				).length - 1;
	return (
		<ButtonLink
			to="/editor/$projectId/project/form/$sectionId"
			params={{
				projectId: project.projectId,
				sectionId: "artwork",
			}}
			search={
				avatarIndex === undefined
					? {}
					: {
							avatar: avatarIndex,
						}
			}
			className={className}
			data-ui={dataUi}
		>
			{content}
		</ButtonLink>
	);
};
