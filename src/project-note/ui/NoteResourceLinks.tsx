import { match, P } from "ts-pattern";
import { Tx } from "~/translation/ui/Tx";
import { Trash2 } from "lucide-react";

import { EditorResourceThumbnail } from "~/authoring-form/ui/EditorResourceThumbnail";
import { EditorArtworkDetailLink } from "~/artwork-authoring/ui/EditorArtworkDetailLink";
import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { Button, ButtonLink } from "~/ui/ui/Button";

interface NoteResourceLinksProps {
	readonly resourceUids: ReadonlyArray<string>;
	readonly requiredResourceUid?: string;
	readonly disabled: boolean;
	readonly filter?: ArtworkCatalogFilterSchema.Type;
	readonly query?: string;
	readonly onChangeFn?: (resourceUids: ReadonlyArray<string>) => void;
	readonly onUnlinkFn?: (resourceUid: string) => void;
}

/** Resolves each resource relationship without treating Notes as runtime usage. */
export const NoteResourceLinks = ({
	resourceUids,
	requiredResourceUid,
	disabled,
	filter,
	query,
	onChangeFn,
	onUnlinkFn,
}: NoteResourceLinksProps) => {
	const project = useEditorProject();
	if (resourceUids.length === 0) return null;
	return (
		<div
			className="grid min-w-0 gap-3"
			data-ui="EditorNoteResourceLinks"
		>
			<span className="text-sm font-semibold">
				<Tx label="Resources" />:
			</span>
			<div className="flex flex-wrap gap-2">
				{resourceUids.map((resourceUid) => {
					const resource = project.resources.find(
						(candidate) => candidate.uid === resourceUid,
					);
					return (
						<div
							key={resourceUid}
							className="flex min-w-0 items-center gap-1 rounded-xl border border-line bg-canvas/50 p-1"
						>
							{match(resource)
								.with(
									{
										type: "artwork",
									},
									(resource) => (
										<EditorArtworkDetailLink
											resourceUid={resourceUid}
											filter={filter}
											query={query}
											className="flex min-w-0 items-center gap-2 pr-2 text-sm"
										>
											<EditorResourceThumbnail
												resourceUid={resourceUid}
												size="sm"
											/>
											<span className="truncate">{resource.title}</span>
										</EditorArtworkDetailLink>
									),
								)
								.with(
									{
										type: "image",
									},
									(resource) => (
										<ButtonLink
											to="/editor/$projectId/project/detail/$sectionId"
											params={{
												projectId: project.projectId,
												sectionId: "images",
											}}
											className="flex min-h-0 min-w-0 items-center gap-2 border-0 bg-transparent p-0 pr-2 text-left text-sm font-normal text-accent shadow-none hover:bg-transparent hover:text-accent-hover"
										>
											<EditorResourceThumbnail
												resourceUid={resourceUid}
												size="sm"
											/>
											<span className="truncate">{resource.title}</span>
										</ButtonLink>
									),
								)
								.with(
									{
										type: P.union("music", "sfx"),
									},
									(resource) => (
										<ButtonLink
											to={
												resource.type === "music"
													? "/editor/$projectId/music/$resourceUid/$sectionId"
													: "/editor/$projectId/sfx/$resourceUid/$sectionId"
											}
											params={{
												projectId: project.projectId,
												resourceUid,
												sectionId: "view",
											}}
											className="flex min-h-0 min-w-0 items-center gap-2 border-0 bg-transparent p-0 pr-2 text-left text-sm font-normal text-accent shadow-none hover:bg-transparent hover:text-accent-hover"
										>
											<EditorResourceThumbnail
												resourceUid={resourceUid}
												size="sm"
											/>
											<span className="truncate">
												{resource.title ?? resourceUid}
											</span>
										</ButtonLink>
									),
								)
								.with(undefined, () => (
									<span
										className="px-2 text-sm text-muted"
										data-ui="EditorNoteMissingResource"
									>
										<Tx label="Unavailable resource" /> · {resourceUid}
									</span>
								))
								.exhaustive()}

							<Button
								className="size-8 min-h-0 shrink-0 border-0 bg-transparent p-0 text-muted shadow-none hover:text-danger"
								data-ui="EditorNoteUnlinkResource"
								disabled={disabled || requiredResourceUid === resourceUid}
								onClick={() => {
									if (disabled || requiredResourceUid === resourceUid) return;
									if (onChangeFn !== undefined)
										onChangeFn(
											resourceUids.filter(
												(linkedId) => linkedId !== resourceUid,
											),
										);
									else onUnlinkFn?.(resourceUid);
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
