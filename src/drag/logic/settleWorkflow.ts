export namespace settleWorkflow {
	export interface Props {
		send(
			event:
				| {
						type: "SETTLING_STARTED";
				  }
				| {
						type: "DROP_SETTLED";
				  },
		): void;
	}
}

export const settleWorkflow = ({ send }: settleWorkflow.Props) => {
	send({
		type: "SETTLING_STARTED",
	});
	send({
		type: "DROP_SETTLED",
	});
};
