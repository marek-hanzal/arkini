import { EditorAssetDetailLink } from "~/asset-authoring/ui/EditorAssetDetailLink";
import { EditorAssetThumbnail } from "~/authoring-form/ui/EditorAssetThumbnail";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { ProjectAvatarKeys } from "~/project-authoring/schema/ProjectFormSchema";
import type { Project } from "~/project-authoring/type/Project";

const ProjectAssetDetail = ({ resourceId }: { readonly resourceId: string }) => (
	<div className="flex items-center gap-3">
		<EditorAssetThumbnail resourceId={resourceId} />
		<EditorAssetDetailLink
			className="font-mono text-sm"
			resourceId={resourceId}
		>
			{resourceId}
		</EditorAssetDetailLink>
	</div>
);

export const ProjectGeneralDetail = ({ project }: { readonly project: Project }) => {
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
			<EditorRootCard dataUi="EditorProjectGeneralDetailCard">
				<DetailSection title="General">
					<DetailFacts>
						<DetailFact
							label="Title"
							value={project.config.meta.title}
						/>
						<DetailFact
							label="Project ID"
							mono
							value={project.projectId}
						/>
					</DetailFacts>
				</DetailSection>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorProjectHeroDetailCard">
				<DetailSection title="Hero image">
					<ProjectAssetDetail resourceId={project.config.resources.hero} />
				</DetailSection>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorProjectAvatarsDetailCard">
				<DetailSection title="About avatars">
					{avatars.length === 0 ? (
						<p className="text-sm text-muted">No About avatars configured.</p>
					) : (
						<ul className="grid gap-3">
							{avatars.map(({ resourceId, slot }) => (
								<li
									className="flex items-center gap-3"
									key={slot}
								>
									<EditorAssetThumbnail resourceId={resourceId} />
									<span className="font-mono text-sm font-semibold">{slot}</span>
									<span className="text-muted">·</span>
									<EditorAssetDetailLink
										className="font-mono text-sm"
										resourceId={resourceId}
									>
										{resourceId}
									</EditorAssetDetailLink>
								</li>
							))}
						</ul>
					)}
				</DetailSection>
			</EditorRootCard>
		</div>
	);
};
