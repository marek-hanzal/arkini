import { useAtomSet } from "@effect/atom-react";
import { useStore } from "@tanstack/react-form";
import { match } from "ts-pattern";
import { useCallback, useLayoutEffect, useMemo, type ReactNode } from "react";

import {
	type EditorItem,
	type EditorItemFormValues,
} from "~/bridge/editor/EditorItemModel";
import { EditorProjectFormDirtyAtom } from "~/bridge/editor/EditorProjectFormDirtyAtom";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { Button } from "~/ui/button/Button";
import { useAppForm } from "~/ui/form/EditorForm";
import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { EditorItemArtworkFields } from "~/ui/item/editor/EditorItemArtworkFields";
import { EditorLineFields } from "~/ui/item/editor/EditorLineField";
import { EditorMergeFields } from "~/ui/item/editor/EditorMergeFields";
import { EditorOptionalOutputControl } from "~/ui/item/editor/EditorOptionalOutputControl";
import { EditorProductionFields } from "~/ui/item/editor/EditorProductionFields";
import { useRegisterEditorFormActions } from "~/ui/editor/EditorFormActions";
import { useSaveEditorItemCommand } from "~/ui/item/editor/useSaveEditorItemCommand";

const scopeOptions = [
	{
		label: "Any",
		value: "any",
	},
	{
		label: "Board",
		value: "board",
	},
	{
		label: "Inventory",
		value: "inventory",
	},
	{
		label: "Toolbar",
		value: "toolbar",
	},
] as const;

const createEditorItemFormValues = (item: EditorItem): EditorItemFormValues => ({
	...item,
	merge:
		item.merge === undefined
			? undefined
			: [
					...item.merge,
				],
});

export namespace EditorItemForm {
	export interface Props {
		readonly back: ReactNode;
		readonly initialItem: EditorItem;
		readonly onSaved?: (item: EditorItem) => void | Promise<void>;
		readonly title: string;
	}
}

/** Edits one item locally and publishes only a validated, persisted canonical result. */
export const EditorItemForm = ({
	back,
	initialItem,
	onSaved,
	title,
}: EditorItemForm.Props) => {
	const project = useEditorProject();
	const canonicalItem = useMemo<EditorItemFormValues>(
		() => createEditorItemFormValues(initialItem),
		[initialItem],
	);
	const categoryOptions = Object.values(project.config?.categories ?? {}).map((category) => ({
		label: category.title,
		value: category.id,
	}));
	const form = useAppForm({
		defaultValues: canonicalItem,
	});
	const values = useStore(form.store, (state) => state.values);
	const dirty = useStore(form.store, (state) => state.isDirty);
	const setFormDirty = useAtomSet(EditorProjectFormDirtyAtom(project.projectId));
	const ownerId = `item:${initialItem.uid}`;
	useLayoutEffect(() => {
		setFormDirty({
			dirty,
			ownerId,
		});
		return () => {
			setFormDirty({
				dirty: false,
				ownerId,
			});
		};
	}, [
		dirty,
		ownerId,
		setFormDirty,
	]);
	const mutation = useSaveEditorItemCommand({
		expectedRevision: project.revision,
		itemUid: initialItem.uid,
		projectId: project.projectId,
	});
	const discard = useCallback(() => {
		mutation.reset();
		setFormDirty({
			dirty: false,
			ownerId,
		});
		form.reset(canonicalItem);
	}, [
		canonicalItem,
		form,
		mutation.reset,
		ownerId,
		setFormDirty,
	]);
	const save = useCallback(async () => {
		if (!dirty || mutation.isPending) return;
		const saved = await mutation.mutateAsync(values);
		setFormDirty({
			dirty: false,
			ownerId,
		});
		form.reset(createEditorItemFormValues(saved));
		await onSaved?.(saved);
	}, [
		dirty,
		form,
		mutation.isPending,
		mutation.mutateAsync,
		onSaved,
		ownerId,
		setFormDirty,
		values,
	]);
	const actions = useMemo(
		() => ({
			discard,
			error: mutation.error ?? undefined,
			isDirty: dirty,
			isSaving: mutation.isPending,
			save,
		}),
		[
			dirty,
			discard,
			mutation.error,
			mutation.isPending,
			save,
		],
	);
	useRegisterEditorFormActions(actions);

	return (
		<section
			className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[var(--ak-viewport-gap)]"
			aria-labelledby="editor-item-form-title"
			data-ui="EditorItemForm"
		>
			<header className="flex min-w-0 flex-wrap items-center gap-3">
				{back}
				<div className="min-w-0 flex-1">
					<h1
						id="editor-item-form-title"
						className="truncate text-xl font-semibold"
					>
						{title}
					</h1>
					<p className="mt-1 text-xs uppercase tracking-wider text-muted">
						{initialItem.type}
					</p>
				</div>
			</header>
			<div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
				<div className="mx-auto grid w-full max-w-5xl gap-4 pb-8">
					<EditorFormSection
						title="Identity"
						description="Stable source identity and player-facing copy."
					>
						<div className="grid gap-4 md:grid-cols-2">
							<form.AppField name="id">
								{(field) => (
									<field.TextField
										label="Item ID"
										description="Changing an existing ID also changes every reference you must update elsewhere."
										placeholder="item:example"
									/>
								)}
							</form.AppField>
							<form.AppField name="title">
								{(field) => <field.TextField label="Title" />}
							</form.AppField>
						</div>
						<form.AppField name="description">
							{(field) => <field.TextAreaField label="Description" />}
						</form.AppField>
						<div className="grid gap-4 md:grid-cols-2">
							<form.AppField name="categoryId">
								{(field) =>
									categoryOptions.length === 0 ? (
										<field.TextField label="Category ID" />
									) : (
										<field.ChoiceField
											label="Category"
											options={categoryOptions}
										/>
									)
								}
							</form.AppField>
							{canonicalItem.type === "inventory" ||
							canonicalItem.type === "temporary" ? (
								<div className="grid content-start gap-1.5 text-sm">
									<span className="font-semibold text-foreground">
										Storage scope
									</span>
									<span className="rounded-lg border border-line bg-canvas/50 px-3 py-2 text-muted">
										Board — fixed by {canonicalItem.type} contract
									</span>
								</div>
							) : (
								<form.AppField name="scope">
									{(field) => (
										<field.ChoiceField
											label="Storage scope"
											options={scopeOptions}
										/>
									)}
								</form.AppField>
							)}
						</div>
						<form.AppField name="tags">
							{(field) => (
								<field.TagsField
									label="Tags"
									description="Comma-separated semantic tags used by selectors and search."
								/>
							)}
						</form.AppField>
					</EditorFormSection>

					<EditorFormSection
						title="Artwork"
						description="The default composition supports one or two layered PNG assets."
					>
						<EditorItemArtworkFields
							form={form}
							fields="asset"
						/>
					</EditorFormSection>

					{canonicalItem.type === "inventory" ? null : (
						<EditorFormSection
							title="Limits"
							description="Configured global and per-stack quantity constraints."
						>
							<div className="grid gap-4 md:grid-cols-2">
								<form.AppField name="maxCount">
									{(field) => (
										<field.NumberField
											label="Maximum global count"
											description="Leave empty for no global limit."
											min={1}
											optional
										/>
									)}
								</form.AppField>
								{canonicalItem.type === "temporary" ? null : (
									<form.AppField name="maxStackSize">
										{(field) => (
											<field.NumberField
												label="Maximum stack size"
												min={1}
											/>
										)}
									</form.AppField>
								)}
							</div>
						</EditorFormSection>
					)}

					<EditorFormSection
						title="Charges"
						description="Optional finite lifetime shared by every fresh instance."
					>
						<form.Subscribe selector={(state) => state.values.charges}>
							{(charges) =>
								charges === undefined ? (
									<Button
										className="justify-self-start"
										onClick={() =>
											form.setFieldValue("charges", {
												amount: 1,
											})
										}
									>
										Enable charges
									</Button>
								) : (
									<div className="grid gap-4">
										<div className="flex items-end gap-3">
											<div className="min-w-0 flex-1">
												<form.AppField name="charges.amount">
													{(field) => (
														<field.NumberField
															label="Initial charges"
															min={1}
														/>
													)}
												</form.AppField>
											</div>
											<Button
												onClick={() =>
													form.setFieldValue("charges", undefined)
												}
											>
												Disable
											</Button>
										</div>
										<EditorOptionalOutputControl
											addLabel="Add depletion output"
											removeLabel="Remove output"
											value={charges.output}
											onChange={(output) =>
												form.setFieldValue("charges.output", output)
											}
										/>
									</div>
								)
							}
						</form.Subscribe>
					</EditorFormSection>

					<form.Subscribe selector={(state) => state.values.merge}>
						{(merge) => (
							<EditorMergeFields
								value={merge}
								onChange={(next) => form.setFieldValue("merge", next)}
							/>
						)}
					</form.Subscribe>

					{match(canonicalItem)
						.with(
							{
								type: "deposit",
							},
							() => (
								<EditorProductionFields
									form={form}
									fields={{
										maxQueueSize: "maxQueueSize",
										lines: "lines",
									}}
									kind="deposit"
									ownerId={values.id}
								/>
							),
						)
						.with(
							{
								type: "producer",
							},
							() => (
								<EditorProductionFields
									form={form}
									fields={{
										maxQueueSize: "maxQueueSize",
										lines: "lines",
									}}
									kind="producer"
									ownerId={values.id}
								/>
							),
						)
						.with(
							{
								type: "temporary",
							},
							() => (
								<EditorFormSection title="Temporary lifetime">
									<form.AppField name="durationMs">
										{(field) => (
											<field.NumberField
												label="Duration (milliseconds)"
												min={500}
											/>
										)}
									</form.AppField>
									<form.Subscribe
										selector={(state) =>
											state.values.type === "temporary"
												? state.values.output
												: undefined
										}
									>
										{(output) => (
											<EditorOptionalOutputControl
												addLabel="Add expiry output"
												removeLabel="Remove expiry output"
												value={output}
												onChange={(next) =>
													form.setFieldValue("output", next)
												}
											/>
										)}
									</form.Subscribe>
								</EditorFormSection>
							),
						)
						.with(
							{
								type: "blueprint",
							},
							{
								type: "craft",
							},
							{
								type: "stash",
							},
							() => (
								<EditorFormSection
									title="Product line"
									description="Inputs, outputs and base behavior owned by this item."
								>
									<EditorLineFields
										form={form}
										fields="line"
										label="Product line"
									/>
								</EditorFormSection>
							),
						)
						.with(
							{
								type: "inventory",
							},
							{
								type: "simple",
							},
							() => null,
						)
						.exhaustive()}

				</div>
			</div>
		</section>
	);
};
