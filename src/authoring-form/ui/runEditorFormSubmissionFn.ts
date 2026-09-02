interface BooleanCell {
	current: boolean;
}

export namespace runEditorFormSubmissionFn {
	export interface Props {
		readonly dirty: boolean;
		readonly notify: boolean;
		readonly notifyOnSaved: BooleanCell;
		readonly onInvalidFn: () => void | Promise<void>;
		readonly submitFn: () => Promise<void>;
		readonly submitting: boolean;
		readonly submitSucceeded: BooleanCell;
	}
}

export const runEditorFormSubmissionFn = async ({
	dirty,
	notify,
	notifyOnSaved,
	onInvalidFn,
	submitFn,
	submitting,
	submitSucceeded,
}: runEditorFormSubmissionFn.Props): Promise<boolean> => {
	if (!dirty || submitting) return false;
	submitSucceeded.current = false;
	notifyOnSaved.current = notify;
	try {
		await submitFn();
	} finally {
		notifyOnSaved.current = true;
	}
	if (!submitSucceeded.current) await onInvalidFn();
	return submitSucceeded.current;
};
