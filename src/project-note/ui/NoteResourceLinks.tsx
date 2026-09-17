import { Tx } from "~/translation/ui/Tx";
import { Trash2 } from "lucide-react";

import { EditorResourceThumbnail } from "~/authoring-form/ui/EditorResourceThumbnail";
import { EditorArtworkDetailLink } from "~/artwork-authoring/ui/EditorArtworkDetailLink";
import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { Button, ButtonLink } from "~/ui/ui/Button";

interface NoteResourceLinksProps {
	readonly resourceIds: ReadonlyArray<string>;
	readonly requiredResourceId?: string;
	readonly disabled: boolean;
	readonly filter?: ArtworkCatalogFilterSchema.Type;
	readonly query?: string;
	readonly onChangeFn?: (resourceIds: ReadonlyArray<string>) => void;
	readonly onUnlinkFn?: (resourceId: string) => void;
}

/** Resolves each resource relationship without treating Notes as runtime usage. */
export const NoteResourceLinks = ({
	resourceIds,
	requiredResourceId,
	disabled,
	filter,
	query,
	onChangeFn,
	onUnlinkFn,
}: NoteResourceLinksProps) => {
	const project = useEditorProject();
	if (resourceIds.length === 0) return null;
	return (
		<div
			className="grid min-w-0 gap-3"
			data-ui="EditorNoteResourceLinks"
		>
			<span className="text-sm font-semibold">
				<Tx label="Resources" />:
			</span>
			<div className="flex flex-wrap gap-2">
				{resourceIds.map((resourceId) => {
					const resource = project.resources.find(
						(candidate) => candidate.id === resourceId,
					);
					return (
						<div
							key={resourceId}
							className="flex min-w-0 items-center gap-1 rounded-xl border border-line bg-canvas/50 p-1"
						>
							{resource?.type === "artwork" ? (
								<EditorArtworkDetailLink
									resourceId={resourceId}
									filter={filter}
									query={query}
									className="flex min-w-0 items-center gap-2 pr-2 text-sm"
								>
									<EditorResourceThumbnail
										resourceId={resourceId}
										size="sm"
									/>
									<span className="truncate">{resourceId}</span>
								</EditorArtworkDetailLink>
							) : resource?.type === "image" ? (
								<ButtonLink
									to="/editor/$projectId/project/detail/$sectionId"
									params={{
										projectId: project.projectId,
										sectionId: "images",
									}}
									className="flex min-h-0 min-w-0 items-center gap-2 border-0 bg-transparent p-0 pr-2 text-left text-sm font-normal text-accent shadow-none hover:bg-transparent hover:text-accent-hover"
								>
									<EditorResourceThumbnail
										resourceId={resourceId}
										size="sm"
									/>
									<span className="truncate">{resourceId}</span>
								</ButtonLink>
							) : resource?.type === "music" || resource?.type === "sfx" ? (
								<ButtonLink
									to={
										resource.type === "music"
											? "/editor/$projectId/music/$resourceId/$sectionId"
											: "/editor/$projectId/sfx/$resourceId/$sectionId"
									}
									params={{
										projectId: project.projectId,
										resourceId,
										sectionId: "view",
									}}
									className="flex min-h-0 min-w-0 items-center gap-2 border-0 bg-transparent p-0 pr-2 text-left text-sm font-normal text-accent shadow-none hover:bg-transparent hover:text-accent-hover"
								>
									<EditorResourceThumbnail
										resourceId={resourceId}
										size="sm"
									/>
									<span className="truncate">{resource.name ?? resourceId}</span>
								</ButtonLink>
							) : (
								<span
									className="px-2 text-sm text-muted"
									data-ui="EditorNoteMissingResource"
								>
									<Tx label="Unavailable resource" /> · {resourceId}
								</span>
							)}

							<Button
								className="size-8 min-h-0 shrink-0 border-0 bg-transparent p-0 text-muted shadow-none hover:text-danger"
								data-ui="EditorNoteUnlinkResource"
								disabled={disabled || requiredResourceId === resourceId}
								onClick={() => {
									if (disabled || requiredResourceId === resourceId) return;
									if (onChangeFn !== undefined)
										onChangeFn(
											resourceIds.filter(
												(linkedId) => linkedId !== resourceId,
											),
										);
									else onUnlinkFn?.(resourceId);
								}}
							>
								<Trash2 className="size-4" />
							</Button>
						</div>
					);
				})}
			</div>
		</div>
	);
};
