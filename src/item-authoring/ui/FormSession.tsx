import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, type PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorSectionTabs } from "~/authoring-shell/ui/EditorSectionTabs";
import { EditorFormSectionPage } from "~/editor-control/ui/EditorFormSectionPage";
import { FormProvider } from "~/item-authoring/ui/FormContext";
import { SectionLink } from "~/item-authoring/ui/SectionLink";
import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";
import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";
import { ProjectCompatibilityNotice } from "~/project-version/ui/ProjectCompatibilityNotice";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { useFormController } from "~/item-authoring/ui/useFormController";

/** Owns navigation, controller state, tabs, and save presentation for one item form lifecycle. */
export const FormSession = ({
	children,
	enableCapability,
	initialItem,
	isNew,
	itemType,
	mergeIndex,
	productionLineId,
	sectionId,
}: PropsWithChildren<{
	readonly enableCapability?: OptionalCapability;
	readonly initialItem: ItemSchema.Type;
	readonly isNew: boolean;
	readonly itemType?: TypeSchema.Type;
	readonly mergeIndex?: number;
	readonly productionLineId?: string;
	readonly sectionId: SectionId;
}>) => {
	const navigateFn = useNavigate();
	const project = useEditorProject();
	const onInvalidSectionFn = useCallback(
		(nextSectionId: SectionId, path: ReadonlyArray<PropertyKey>) =>
			navigateFn({
				to: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
				params: {
					projectId: project.projectId,
					itemUid: initialItem.uid,
					sectionId: nextSectionId,
				},
				search: {
					...(itemType === undefined
						? {}
						: {
								itemType,
							}),
					...(nextSectionId === "merges" && typeof path[1] === "number"
						? {
								merge: path[1],
							}
						: {}),
				},
			}),
		[
			initialItem.uid,
			itemType,
			navigateFn,
			project.projectId,
		],
	);
	const controller = useFormController({
		enableCapability,
		initialItem,
		onInvalidSectionFn,
		onSavedFn: (saved) =>
			navigateFn({
				to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
				params: {
					projectId: project.projectId,
					itemUid: saved.uid,
					sectionId,
				},
				replace: true,
			}),
	});
	const discardFn = useCallback(async () => {
		controller.discardFn();
		if (isNew) {
			await navigateFn({
				to: "/editor/$projectId/editor/items/list",
				params: {
					projectId: project.projectId,
				},
				replace: true,
			});
			return;
		}
		await navigateFn({
			to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
			params: {
				projectId: project.projectId,
				itemUid: initialItem.uid,
				sectionId,
			},
			replace: true,
		});
	}, [
		controller.discardFn,
		initialItem.uid,
		isNew,
		navigateFn,
		project.projectId,
		sectionId,
	]);
	const context = useMemo(
		() => ({
			...controller,
			isNew,
			itemType,
			mergeIndex,
			productionLineId,
		}),
		[
			controller,
			isNew,
			itemType,
			mergeIndex,
			productionLineId,
		],
	);
	const sections = readSectionsFn(initialItem, "form");
	const params = {
		projectId: project.projectId,
		itemUid: initialItem.uid,
	};
	const title = isNew ? `New ${initialItem.type}` : initialItem.title || initialItem.id;
	return (
		<FormProvider value={context}>
			<section
				className="h-full min-h-0"
				data-ui="EditorItemForm"
			>
				<EditorFormSectionPage
					discardFn={discardFn}
					dirty={controller.isDirty}
					error={controller.error}
					notice={
						<ProjectCompatibilityNotice
							compatibility={controller.compatibility}
							version={project.version}
						/>
					}
					rootCard={
						sectionId !== "action" &&
						sectionId !== "artwork" &&
						sectionId !== "charges" &&
						sectionId !== "merges" &&
						sectionId !== "production"
					}
					saveFn={controller.saveFn}
					saving={controller.isSaving}
					leading={
						isNew ? (
							<EditorHistoryBackButton
								to="/editor/$projectId/editor/items/list"
								params={{
									projectId: params.projectId,
								}}
							/>
						) : (
							<EditorHistoryBackButton
								to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
								params={{
									...params,
									sectionId,
								}}
							/>
						)
					}
					title={<h1 className="truncate text-xl font-semibold">{title}</h1>}
					tabs={
						<EditorSectionTabs>
							{sections.map((candidate) => (
								<SectionLink
									key={candidate.id}
									itemType={itemType}
									itemUid={params.itemUid}
									projectId={params.projectId}
									section={candidate}
								/>
							))}
						</EditorSectionTabs>
					}
				>
					{children}
				</EditorFormSectionPage>
			</section>
		</FormProvider>
	);
};
