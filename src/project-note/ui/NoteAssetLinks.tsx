import { Tx } from "~/translation/ui/Tx";
import { Trash2 } from "lucide-react";

import { EditorAssetThumbnail } from "~/authoring-form/ui/EditorAssetThumbnail";
import { EditorAssetDetailLink } from "~/asset-authoring/ui/EditorAssetDetailLink";
import type { AssetCatalogFilterSchema } from "~/asset-authoring/schema/AssetCatalogFilterSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { Button } from "~/ui/ui/Button";
import { Tooltip } from "~/ui/ui/Tooltip";

interface NoteAssetLinksProps {
	readonly resourceIds: ReadonlyArray<string>;
	readonly requiredResourceId?: string;
	readonly disabled: boolean;
	readonly filter?: AssetCatalogFilterSchema.Type;
	readonly query?: string;
	readonly onChangeFn?: (resourceIds: ReadonlyArray<string>) => void;
	readonly onUnlinkFn?: (resourceId: string) => void;
}

/** Resolves each asset relationship without treating Notes as resource usage. */
export const NoteAssetLinks = ({
	resourceIds,
	requiredResourceId,
	disabled,
	filter,
	query,
	onChangeFn,
	onUnlinkFn,
}: NoteAssetLinksProps) => {
	const project = useEditorProject();
	if (resourceIds.length === 0) return null;
	return (
		<div
			className="grid min-w-0 gap-3"
			data-ui="EditorNoteAssetLinks"
		>
			<span className="text-sm font-semibold">
				<Tx label="Assets" />:
			</span>
			<div className="flex flex-wrap gap-2">
				{resourceIds.map((resourceId) => {
					const exists = project.resources.some((resource) => resource.id === resourceId);
					return (
						<div
							key={resourceId}
							className="flex min-w-0 items-center gap-1 rounded-xl border border-line bg-canvas/50 p-1"
						>
							{exists ? (
								<EditorAssetDetailLink
									resourceId={resourceId}
									filter={filter}
									query={query}
									className="flex min-w-0 items-center gap-2 pr-2 text-sm"
								>
									<EditorAssetThumbnail
										resourceId={resourceId}
										size="sm"
									/>
									<span className="truncate">{resourceId}</span>
								</EditorAssetDetailLink>
							) : (
								<span
									className="px-2 text-sm text-muted"
									data-ui="EditorNoteMissingAsset"
								>
									Unavailable asset · {resourceId}
								</span>
							)}
							<Tooltip
								content={
									requiredResourceId === resourceId
										? "New notes stay linked to this asset"
										: "Unlink asset from note"
								}
								placement="top"
							>
								<Button
									className="size-8 min-h-0 shrink-0 border-0 bg-transparent p-0 text-muted shadow-none hover:text-danger"
									data-ui="EditorNoteUnlinkAsset"
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
							</Tooltip>
						</div>
					);
				})}
			</div>
		</div>
	);
};
