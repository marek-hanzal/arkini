export type Quantity =
	| number
	| {
			min: number;
			max: number;
	  };
