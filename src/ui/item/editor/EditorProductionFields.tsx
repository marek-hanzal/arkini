import type { EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { createEditorLineDraft } from "~/engine/line/editor/createEditorLineDraft";
import { Button } from "~/ui/button/Button";
import { withFieldGroup } from "~/ui/form/EditorForm";
import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { EditorLineFields } from "~/ui/item/editor/EditorLineField";

interface EditorProductionFieldValues {
	readonly maxQueueSize?: number;
	readonly lines: Array<EditorLine> | undefined;
}

const defaultValues: EditorProductionFieldValues = {
	maxQueueSize: 1,
	lines: undefined,
};

/** Shares the queue and registered line-array editor used by deposits and producers. */
export const EditorProductionFields = withFieldGroup({
	defaultValues,
	props: {
		kind: "producer" as "deposit" | "producer",
		ownerId: "",
	},
	render: ({ group, kind, ownerId }) => (
		<EditorFormSection title={kind === "deposit" ? "Deposit" : "Producer"}>
			<group.AppField name="maxQueueSize">
				{(field) => (
					<field.NumberField
						label="Maximum parallel jobs"
						min={1}
					/>
				)}
			</group.AppField>
			<group.AppField
				name="lines"
				mode="array"
			>
				{(linesField) => {
					const lines = linesField.state.value ?? [];
					return (
						<div className="grid gap-4 border-t border-line pt-4">
							<div className="flex items-center justify-between gap-3">
								<div>
									<h3 className="text-sm font-semibold">
										{kind === "deposit" ? "Production lines" : "Product lines"}
									</h3>
									{kind !== "deposit" ? null : (
										<p className="mt-1 text-xs text-muted">
											Optional self-consuming jobs exposed by this deposit.
										</p>
									)}
								</div>
								<Button
									onClick={() => {
										const line = createEditorLineDraft({
										existingLines: lines,
										itemId: ownerId,
										type: kind,
									});
										if (linesField.state.value === undefined) {
											group.setFieldValue("lines", [
												line,
											]);
											return;
										}
										linesField.pushValue(line);
									}}
								>
									Add line
								</Button>
							</div>
							{lines.map((_line, index) => (
								<div
									key={`${index}`}
									className="grid gap-3 rounded-xl border border-line p-3"
								>
									<EditorLineFields
										form={group}
										fields={`lines[${index}]`}
										label={`${kind === "deposit" ? "Deposit" : "Producer"} line ${index + 1}`}
									/>
									<Button
										className="justify-self-end"
										disabled={kind === "producer" && lines.length === 1}
										onClick={() => {
											if (kind === "producer" && lines.length === 1) return;
											if (kind === "deposit" && lines.length === 1) {
												group.setFieldValue("lines", undefined);
												return;
											}
											linesField.removeValue(index);
										}}
									>
										Remove line
									</Button>
								</div>
							))}
						</div>
					);
				}}
			</group.AppField>
		</EditorFormSection>
	),
});
