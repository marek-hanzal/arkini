import { useItemSectionShortcuts } from "~/item-authoring/ui/useItemSectionShortcuts";
import { ItemSectionDisableControl } from "~/item-authoring/ui/ItemSectionDisableControl";
import { ItemSectionCopyControl } from "~/item-authoring/ui/ItemSectionCopyControl";
import { ItemHeaderTitle } from "~/item-authoring/ui/ItemHeaderTitle";
import { readCanonicalItemArtworkFn } from "~/item-authoring/schema/FormSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, type PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { EditorSectionBar } from "~/authoring-shell/ui/EditorSectionBar";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
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
	defaultTitle,
	enableCapability,
	initialItem,
	isNew,
	create,
	inputIndex,
	ruleIndex,
	whenIndex,
	mergeIndex,
	outcomeSetIndex,
	outcomeRollIndex,
	outcomeIndex,
	productionLineId,
	productionLineIndex,
	resourceUid,
	sectionId,
}: PropsWithChildren<{
	readonly defaultDraft?: boolean;
	readonly defaultTitle?: string;
	readonly enableCapability?: OptionalCapability;
	readonly initialItem: ItemSchema.Type;
	readonly isNew: boolean;
	readonly create?: boolean;
	readonly inputIndex?: number;
	readonly ruleIndex?: number;
	readonly whenIndex?: number;
	readonly mergeIndex?: number;
	readonly outcomeSetIndex?: number;
	readonly outcomeRollIndex?: number;
	readonly outcomeIndex?: number;
	readonly productionLineId?: string;
	readonly productionLineIndex?: number;
	readonly resourceUid?: string;
	readonly sectionId: SectionId;
}>) => {
	const navigateFn = useNavigate();
	const translator = useTranslator();
	const project = useEditorProject();
	useItemSectionShortcuts({
		enabled: true,
		destination: "form",
		itemUid: initialItem.uid,
		projectId: project.projectId,
		sections: readSectionsFn("form"),
		search: {
			defaultDraft,
			defaultTitle,
			create,
			resourceUid,
		},
	});
	const unsavedChanges = useEditorUnsavedChangesOwner();
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
					...(resourceUid === undefined
						? {}
						: {
								resourceUid,
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
			defaultTitle,
			initialItem.uid,
			create,
			navigateFn,
			project.projectId,
			resourceUid,
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
					sectionId,
				},
				replace: true,
			}).catch(() => undefined);
		},
	});
	const discardFn = useCallback(async () => {
		const targetPathname = isNew
			? `/editor/${project.projectId}/editor/items/list`
			: `/editor/${project.projectId}/editor/items/${initialItem.uid}/detail/${sectionId}`;
		if (!(await unsavedChanges.requestLeaveFn(targetPathname))) return;
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
		initialItem.uid,
		isNew,
		navigateFn,
		project.projectId,
		sectionId,
		unsavedChanges,
	]);
	const context = useMemo(
		() => ({
			...controller,
			isNew,
			create,
			inputIndex,
			ruleIndex,
			whenIndex,
			mergeIndex,
			outcomeSetIndex,
			outcomeRollIndex,
			outcomeIndex,
			productionLineId,
			productionLineIndex,
		}),
		[
			controller,
			isNew,
			create,
			inputIndex,
			ruleIndex,
			whenIndex,
			mergeIndex,
			outcomeSetIndex,
			outcomeRollIndex,
			outcomeIndex,
			productionLineId,
			productionLineIndex,
		],
	);
	const sections = readSectionsFn("form");
	const help = ItemSectionHelp[sectionId];
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
					contentMode={sectionId === "artwork" ? "viewport" : "scroll"}
					discardFn={discardFn}
					error={controller.error}
					rootCard={
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
									sectionId,
								}}
							/>
						)
					}
					title={
						<controller.form.Subscribe
							selector={(state) =>
								[
									state.values.title,
									state.values.artwork,
								] as const
							}
						>
							{([title, artwork]) => (
								<ItemHeaderTitle
									resourceUids={readCanonicalItemArtworkFn(artwork).default}
									title={
										title.trim() ||
										(isNew ? translator.textFn("New item") : initialItem.uid)
									}
								/>
							)}
						</controller.form.Subscribe>
					}
					secondaryNavigation={
						<EditorSectionBar
							actions={
								<>
									<ItemSectionCopyControl
										key={sectionId}
										sectionId={sectionId}
									/>
									<ItemSectionDisableControl sectionId={sectionId} />
								</>
							}
							help={help === undefined ? undefined : <EditorPageHelp {...help} />}
						>
							{sections.map((candidate) => (
								<SectionLink
									defaultDraft={defaultDraft}
									defaultTitle={defaultTitle}
									key={candidate.id}
									create={create}
									itemUid={params.itemUid}
									projectId={params.projectId}
									resourceUid={resourceUid}
									section={candidate}
								/>
							))}
						</EditorSectionBar>
					}
				>
					{children}
				</EditorFormSectionPage>
			</section>
		</FormProvider>
	);
};
