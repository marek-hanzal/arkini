import { ChevronRight, Unlink } from "lucide-react";
import { useMemo } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { createAcquisitionGraphFn } from "~/flow/fn/createAcquisitionGraphFn";
import { readRequiredByFactIdsFn } from "~/flow/fn/readRequiredByFactIdsFn";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
import { Status } from "~/ui/ui/Status";

/** Presents the global authored consumers of one item independently from an estimate route. */
export const RequiredBySection = ({ itemId }: { readonly itemId: string }) => {
	const project = useEditorProject();
	const requiredByItems = useMemo(
		() =>
			readRequiredByFactIdsFn(createAcquisitionGraphFn(project.config), itemId)
				.flatMap((requiredByItemId) => {
					const item = project.config.items[requiredByItemId];
					return item === undefined
						? []
						: [
								item,
							];
				})
				.sort(
					(left, right) =>
						left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
				),
		[
			itemId,
			project.config,
		],
	);

	if (requiredByItems.length === 0)
		return (
			<Status
				dataUi="EditorItemRequiredByEmpty"
				description="No authored item depends on this item, so it is currently unused in the game economy."
				icon={Unlink}
				title="Nothing requires this item"
			/>
		);

	return (
		<section
			className="ak-list grid gap-2"
			data-ui="EditorItemRequiredBy"
		>
			{requiredByItems.map((item) => (
				<article
					className="ak-list-row ak-list-row-interactive relative flex min-h-16 min-w-0 items-center gap-4 rounded-xl p-3"
					data-ui="EditorItemRequiredByRow"
					key={item.id}
				>
					<DetailReference
						itemId={item.id}
						sectionId="required-by"
						stretched
					/>
					<ChevronRight className="pointer-events-none relative z-10 size-5 shrink-0 text-subtle" />
				</article>
			))}
		</section>
	);
};
