import { EditorAssetReference } from "~/asset-authoring/ui/EditorAssetReference";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { ProjectAvatarKeys } from "~/project-authoring/schema/ProjectFormSchema";
import type { Project } from "~/project-authoring/type/Project";

/** Presents the project-wide launcher hero and About portraits. */
export const ProjectArtworkDetail = ({ project }: { readonly project: Project }) => {
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
				<DetailSection title="Hero image">
					<EditorAssetReference resourceId={project.config.resources.hero} />
				</DetailSection>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorProjectAvatarsDetailCard">
				<DetailSection title="About avatars">
					{avatars.length === 0 ? (
						<p className="text-sm text-muted">No About avatars configured.</p>
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
