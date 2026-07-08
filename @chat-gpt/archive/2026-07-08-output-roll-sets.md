# Output roll sets

All activation outputs now use ordered output sets:

```json
"output": [
  {
    "weight": 3,
    "entries": [
      { "type": "guaranteed", "itemId": "item:vegetables" }
    ]
  },
  {
    "weight": 1,
    "entries": [
      { "type": "guaranteed", "itemId": "item:vegetables" },
      { "type": "guaranteed", "itemId": "item:egg" }
    ]
  }
]
```

A single-set output is the ordinary case and behaves like the old flat output after one level of nesting:

```json
"output": [
  {
    "entries": [
      { "type": "guaranteed", "itemId": "item:log" }
    ]
  }
]
```

Runtime semantics: evaluate sets in authored order using remaining relative weight. The first set whose roll wins is selected. After a set is selected, its entries use the existing output rules: guaranteed, chance, weighted entries, quantities, output effects, placement, and stack handling.

There is no recursive output-set nesting. If more structure is needed later, add it intentionally instead of smuggling another mini-language into `entries`, because that's how config becomes haunted furniture.

Craft/blueprint completion and product lines both use this shape. Craft completion still routes through producer-style output placement, so multi-output quest rewards can place on the craft cell, around it, stack onto existing board stacks, and fall back to inventory through the same placement path.
