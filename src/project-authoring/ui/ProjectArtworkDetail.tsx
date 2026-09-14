import { Mx } from "~/translation/ui/Mx";
import { ImagePlus } from "lucide-react";

import { EditorAssetDetailLink } from "~/asset-authoring/ui/EditorAssetDetailLink";
import { EditorAssetReference } from "~/asset-authoring/ui/EditorAssetReference";
import { EditorAssetThumbnail } from "~/authoring-form/ui/EditorAssetThumbnail";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { ProjectAvatarKeys } from "~/project-authoring/schema/ProjectFormSchema";
import type { Project } from "~/project-authoring/type/Project";
import { useTranslator } from "~/translation/ui/useTranslator";
import { PrimaryButtonLink } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";

/** Presents the project-wide launcher hero and About portraits. */
export const ProjectArtworkDetail = ({ project }: { readonly project: Project }) => {
	const translator = useTranslator();
	const heroResourceId = project.config.resources.hero;
	const heroUrl = useResourceUrl(heroResourceId);
	const avatars = ProjectAvatarKeys.flatMap((slot) => {
		const resourceId = project.config.resources[slot];
		return resourceId === undefined
			? []
			: [
					{
						resourceId,
						slot,
					},
				];
	});
	return (
		<div
			className="grid gap-6"
			data-ui="EditorProjectArtworkDetail"
		>
			<EditorRootCard
				className="justify-items-center"
				dataUi="EditorProjectHeroDetailCard"
			>
				{heroUrl === undefined ? (
					<EditorAssetReference resourceId={heroResourceId} />
				) : (
					<EditorAssetDetailLink
						className="w-full max-w-3xl active:bg-transparent"
						resourceId={heroResourceId}
					>
						<img
							className="max-h-[45dvh] w-full object-contain"
							src={heroUrl}
							alt=""
							draggable={false}
						/>
					</EditorAssetDetailLink>
				)}
			</EditorRootCard>
			<hr className="border-line/70" />
			<EditorRootCard dataUi="EditorProjectAvatarsDetailCard">
				{avatars.length === 0 ? (
					<Status
						variant="flat"
						description={<Mx label="Project avatars empty help" />}
						icon={ImagePlus}
						title={translator.textFn("No About avatars configured.")}
						action={
							<PrimaryButtonLink
								to="/editor/$projectId/project/form/$sectionId"
								params={{
									projectId: project.projectId,
									sectionId: "artwork",
								}}
							>
								{translator.textFn("Add avatars")}
							</PrimaryButtonLink>
						}
					/>
				) : (
					<ul className="grid grid-cols-2 gap-x-6 gap-y-3">
						{avatars.map(({ resourceId, slot }) => (
							<li
								className="flex min-w-0 justify-center"
								key={slot}
							>
								<EditorAssetDetailLink
									className="min-w-0 gap-3 text-foreground active:bg-transparent"
									resourceId={resourceId}
								>
									<EditorAssetThumbnail resourceId={resourceId} />
									<span className="truncate font-mono text-sm font-semibold">
										{slot}
									</span>
								</EditorAssetDetailLink>
							</li>
						))}
					</ul>
				)}
			</EditorRootCard>
		</div>
	);
};
