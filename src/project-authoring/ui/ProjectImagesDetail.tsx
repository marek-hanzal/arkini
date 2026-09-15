import { Mx } from "~/translation/ui/Mx";
import { ImagePlus } from "lucide-react";

import { EditorResourceThumbnail } from "~/authoring-form/ui/EditorResourceThumbnail";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { ProjectAvatarKeys } from "~/project-authoring/schema/ProjectFormSchema";
import type { Project } from "~/project-authoring/type/Project";
import { useTranslator } from "~/translation/ui/useTranslator";
import { PrimaryButtonLink } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";
import { ProjectImageLibrary } from "~/project-authoring/ui/ProjectImageLibrary";

/** Presents the project-wide launcher hero and About portraits. */
export const ProjectImagesDetail = ({ project }: { readonly project: Project }) => {
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
			data-ui="EditorProjectImagesDetail"
		>
			<EditorRootCard
				className="justify-items-center"
				dataUi="EditorProjectHeroDetailCard"
			>
				{heroUrl === undefined ? (
					<span className="font-mono text-sm text-muted">{heroResourceId}</span>
				) : (
					<img
						className="max-h-[45dvh] w-full max-w-3xl object-contain"
						src={heroUrl}
						alt=""
						draggable={false}
					/>
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
									sectionId: "images",
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
								<div className="flex min-w-0 items-center gap-3 text-foreground">
									<EditorResourceThumbnail resourceId={resourceId} />
									<span className="truncate font-mono text-sm font-semibold">
										{slot}
									</span>
								</div>
							</li>
						))}
					</ul>
				)}
			</EditorRootCard>
			<hr className="border-line/70" />
			<ProjectImageLibrary project={project} />
		</div>
	);
};
