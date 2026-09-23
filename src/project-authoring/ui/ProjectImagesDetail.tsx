import { CircleHelp } from "lucide-react";

import { EditorResourceThumbnail } from "~/authoring-form/ui/EditorResourceThumbnail";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { ProjectAvatarKeys } from "~/project-authoring/schema/ProjectFormSchema";
import type { Project } from "~/project-authoring/type/Project";
import { useTranslator } from "~/translation/ui/useTranslator";
import { ProjectImageLibrary } from "~/project-authoring/ui/ProjectImageLibrary";

/** Presents the project-wide launcher hero and About portraits. */
export const ProjectImagesDetail = ({ project }: { readonly project: Project }) => {
	const translator = useTranslator();
	const heroResourceUid = project.config.resources.hero;
	const heroUrl = useResourceUrl(heroResourceUid);
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
					<span className="font-mono text-sm text-muted">{heroResourceUid}</span>
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
				<ul
					className="grid grid-cols-4 gap-3"
					data-ui="EditorProjectAvatarGrid"
				>
					{ProjectAvatarKeys.map((slot) => {
						const resourceUid = project.config.resources[slot];
						return (
							<li
								className="grid min-w-0 gap-2 rounded-xl border border-line bg-surface/60 p-3"
								data-ui="EditorProjectAvatarSlot"
								data-avatar-slot={slot}
								key={slot}
							>
								<div className="grid min-h-36 min-w-0 place-items-center gap-2 rounded-lg border border-control-border bg-canvas/50 p-2 text-foreground">
									{resourceUid === undefined ? (
										<CircleHelp className="size-8 text-muted" />
									) : (
										<EditorResourceThumbnail
											resourceUid={resourceUid}
											size="lg"
										/>
									)}
									<span className="font-mono text-sm font-semibold">{slot}</span>
									<span className="max-w-full truncate text-xs text-muted">
										{resourceUid ?? translator.textFn("No image selected")}
									</span>
								</div>
							</li>
						);
					})}
				</ul>
			</EditorRootCard>
			<hr className="border-line/70" />
			<ProjectImageLibrary project={project} />
		</div>
	);
};
