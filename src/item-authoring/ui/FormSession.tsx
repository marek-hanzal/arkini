import { readDetailSectionFn } from "~/item-authoring/fn/readDetailSectionFn";
import { useTranslator } from "~/translation/ui/useTranslator";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, type PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorSectionTabs } from "~/authoring-shell/ui/EditorSectionTabs";
import { EditorFormSectionPage } from "~/editor-control/ui/EditorFormSectionPage";
import { ItemSectionHelp } from "~/item-authoring/ui/ItemSectionHelp";
import { FormProvider } from "~/item-authoring/ui/FormContext";
import { SectionLink } from "~/item-authoring/ui/SectionLink";
import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";
import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { useFormController } from "~/item-authoring/ui/useFormController";

/** Owns navigation, controller state, tabs, and save presentation for one item form lifecycle. */
export const FormSession = ({
	children,
	defaultDraft,
	defaultItemId,
	defaultTitle,
	enableCapability,
	initialItem,
	isNew,
	create,
	mergeIndex,
	productionLineId,
	resourceId,
	sectionId,
}: PropsWithChildren<{
	readonly defaultDraft?: boolean;
	readonly defaultItemId?: string;
	readonly defaultTitle?: string;
	readonly enableCapability?: OptionalCapability;
	readonly initialItem: ItemSchema.Type;
	readonly isNew: boolean;
	readonly create?: boolean;
	readonly mergeIndex?: number;
	readonly productionLineId?: string;
	readonly resourceId?: string;
	readonly sectionId: SectionId;
}>) => {
	const navigateFn = useNavigate();
	const translator = useTranslator();
	const detailSectionId = readDetailSectionFn(sectionId);
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
					...(defaultDraft === undefined
						? {}
						: {
								defaultDraft,
							}),
					...(defaultItemId === undefined
						? {}
						: {
								defaultItemId,
							}),
					...(defaultTitle === undefined
						? {}
						: {
								defaultTitle,
							}),
					...(create === undefined
						? {}
						: {
								create,
							}),
					...(resourceId === undefined
						? {}
						: {
								resourceId,
							}),
					...(nextSectionId === "merges" && typeof path[1] === "number"
						? {
								merge: path[1],
							}
						: {}),
				},
			}),
		[
			defaultDraft,
			defaultItemId,
			defaultTitle,
			initialItem.uid,
			create,
			navigateFn,
			project.projectId,
			resourceId,
		],
	);
	const controller = useFormController({
		enableCapability,
		initialItem,
		isNew,
		onInvalidSectionFn,
		onSavedFn: (saved) => {
			void navigateFn({
				to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
				params: {
					projectId: project.projectId,
					itemUid: saved.uid,
					sectionId: detailSectionId,
				},
				replace: true,
			}).catch(() => undefined);
		},
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
				sectionId: detailSectionId,
			},
			replace: true,
		});
	}, [
		controller.discardFn,
		initialItem.uid,
		isNew,
		navigateFn,
		project.projectId,
		detailSectionId,
	]);
	const context = useMemo(
		() => ({
			...controller,
			isNew,
			create,
			mergeIndex,
			productionLineId,
		}),
		[
			controller,
			isNew,
			create,
			mergeIndex,
			productionLineId,
		],
	);
	const sections = readSectionsFn("form");
	const params = {
		projectId: project.projectId,
		itemUid: initialItem.uid,
	};
	return (
		<FormProvider value={context}>
			<section
				className="h-full min-h-0"
				data-ui="EditorItemForm"
			>
				<EditorFormSectionPage
					help={ItemSectionHelp[sectionId]}
					discardFn={discardFn}
					error={controller.error}
					rootCard={
						sectionId !== "action" &&
						sectionId !== "clock" &&
						sectionId !== "artwork" &&
						sectionId !== "units" &&
						sectionId !== "merges" &&
						sectionId !== "production"
					}
					saveEnabled={isNew || controller.isDirty}
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
									sectionId: detailSectionId,
								}}
							/>
						)
					}
					title={
						<controller.form.Subscribe selector={(state) => state.values.title}>
							{(title) => (
								<h1 className="truncate text-xl font-semibold">
									{title.trim() ||
										(isNew ? translator.textFn("New item") : initialItem.id)}
								</h1>
							)}
						</controller.form.Subscribe>
					}
					tabs={
						<EditorSectionTabs>
							{sections.map((candidate) => (
								<SectionLink
									defaultDraft={defaultDraft}
									defaultItemId={defaultItemId}
									defaultTitle={defaultTitle}
									key={candidate.id}
									create={create}
									itemUid={params.itemUid}
									projectId={params.projectId}
									resourceId={resourceId}
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
