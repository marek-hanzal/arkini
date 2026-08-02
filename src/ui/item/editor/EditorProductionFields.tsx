import type { EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { Button } from "~/ui/button/Button";
import { withFieldGroup } from "~/ui/form/EditorForm";
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
		<div className="grid gap-4">
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
										const lineOwnerId =
											ownerId.replace(/^(?:item|producer):/, "") ||
											"new-item";
										const lineIdPrefix = `line:${lineOwnerId}`;
										const existingIds = new Set(lines.map((line) => line.id));
										let id = `${lineIdPrefix}:default`;
										if (lines.length > 0 || existingIds.has(id)) {
											let suffix = 2;
											while (existingIds.has(`${lineIdPrefix}:${suffix}`))
												suffix += 1;
											id = `${lineIdPrefix}:${suffix}`;
										}
										const line: EditorLine = {
											id,
											title: `New ${kind} line`,
											description: `Describe what this ${kind} line consumes and produces.`,
											default: lines.length === 0,
											show: true,
											enable: true,
											runtimeMs: 0,
											input: [
												{
													type: "simple",
												},
											],
											rules: [],
										};
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
		</div>
	),
});
