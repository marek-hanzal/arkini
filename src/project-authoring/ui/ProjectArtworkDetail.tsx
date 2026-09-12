import { ImagePlus } from "lucide-react";
import { Status } from "~/ui/ui/Status";
import { PrimaryButtonLink } from "~/ui/ui/Button";
import { useTranslator } from "~/translation/ui/useTranslator";
import { EditorAssetReference } from "~/asset-authoring/ui/EditorAssetReference";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { ProjectAvatarKeys } from "~/project-authoring/schema/ProjectFormSchema";
import type { Project } from "~/project-authoring/type/Project";

/** Presents the project-wide launcher hero and About portraits. */
export const ProjectArtworkDetail = ({ project }: { readonly project: Project }) => {
	const translator = useTranslator();
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
		<div className="grid gap-6">
			<EditorRootCard dataUi="EditorProjectHeroDetailCard">
				<DetailSection
					title={translator.textFn("Hero image")}
					description={translator.textFn("The project image shown by the launcher.")}
				>
					<EditorAssetReference resourceId={project.config.resources.hero} />
				</DetailSection>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorProjectAvatarsDetailCard">
				<DetailSection
					title={translator.textFn("About avatars")}
					description={translator.textFn(
						"Optional portraits used on the game About screen.",
					)}
				>
					{avatars.length === 0 ? (
						<Status
							variant="flat"
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
						<ul className="grid gap-3">
							{avatars.map(({ resourceId, slot }) => (
								<li key={slot}>
									<EditorAssetReference
										context={slot}
										resourceId={resourceId}
									/>
								</li>
							))}
						</ul>
					)}
				</DetailSection>
			</EditorRootCard>
		</div>
	);
};
