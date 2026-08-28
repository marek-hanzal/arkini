export type QuantityPresentation =
	| {
			readonly kind: "exact";
			readonly quantity: number;
	  }
	| {
			readonly kind: "subtract";
			readonly quantity: number;
	  };
