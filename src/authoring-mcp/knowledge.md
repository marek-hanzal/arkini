# Common

## Spaces

Each Space is an isolated Board with its own contents. All Spaces continue simulating, including those the player is not currently viewing.

## Inventory

An Inventory is a Space bound to a specific Item instance. Two instances of the same Item definition, such as two boxes, have separate Inventories and do not share their contents. Destroying an Item destroys its Inventories and all their contents, recursively through Inventories owned by contained Items. Nested and self-referential Inventories are allowed: they are navigable Spaces created only when first used.

## Player navigation

Any operation that supports Outcomes can move the player to another Space through a Space outcome, including Lines, Merges, and Lines chosen by weighted Clock selection. If one roll resolves multiple Space outcomes, the last successful one determines the destination.

## Item transfer between Spaces

A receiving Item can transport a dragged Item through a receiver-owned Space Merge. Set the destination to another Space or the receiver’s Inventory. A matching explicit Merge rule on the dragged Item takes precedence; the receiver’s transfer rule applies only when no such rule matches.

## Board Templates

A Board Template defines a Board’s size and Item layout. Applying it destroys all Items in the affected Space and replaces them with the Template’s contents, even when the player is viewing another Space. Templates can seed starting Spaces, initialize Item Inventories such as crates or warehouses, and set up minigames. Different Spaces can use different Templates, so their Boards may look entirely different.

## Inventory authoring pattern

1. Give the container a Line with a Space outcome targeting Inventory and a chosen Template. Activating it opens that Item instance’s Inventory.
2. Place an exit Item in the Template. Give its Line a Space outcome with `space: "previous"` to return the player to the Space they came from. Without a previous Space, this outcome does nothing.
3. Give the container a receiver-owned Space Merge targeting Inventory with the same Template, so dragged Items enter the room the player opens.
4. Give the exit Item a receiver-owned Space Merge with `space: "previous"`, so dragged Items can leave the Inventory. Without a previous Space, this transport is rejected.

## Stories from the graph

For questions about Item interactions, start with directional Merges, then inspect the surrounding graph for participant effects, replacements, outcomes, and downstream paths. Use the graph tools to gather that context yourself and answer broad requests such as “Tell me Fawn’s stories” in one coherent response, without asking the user for narrower queries. Preserve conditions and alternatives: an authored possibility is not an observed gameplay event.

## Discovering item possibilities

Use graph discovery for broad questions such as where an Item can be found, what can be done with it, or how another Item can be obtained. Trace each possibility to its authored operation and distinguish placement from production: a bucket in a haunted castle chest is a possible find, while a Carpenter’s Line explains how to make one. Lead with the route that answers the user’s intent, then mention relevant alternatives and conditions. A graph path alone does not prove runtime reachability.

## Item UI modes

Use `ui: "default"` for buildings and other Items whose full set of Lines should be visible to the player. Consider deliberately what their titles and descriptions reveal, including spoilers or intentional jokes. `ui: "simple"` keeps Item Detail compact; when an effective Default Line exists, it still shows its title and required materials, alongside Item facts such as remaining Units on a tree. The `ui` setting changes presentation, not engine behavior.

# Weird stuff (intended)

## Spaces & Inventory

Outcomes can choose among weighted Space or Inventory destinations, subject to Rules. Entry can also require inputs or spend Units, since it remains an ordinary Line. Player navigation and item transport are configured independently: admit a player to a dungeon without their equipment, send Items into a black hole the player cannot enter, or send the player and dragged Items to different Spaces. Together, Spaces, Inventories, and Templates can express mazes, searches, quests, and other elaborate scenarios without special mechanics.

# Clock

## Autonomous Item behavior

An Item’s Clock can choose among multiple weighted `clock-interval` Lines. Line Rules and distance based input queries let it react to nearby Items and other conditions; each choice still follows the ordinary Line job lifecycle. A wolf can appear to hop around the Board when an `item-termination` Line creates a fresh wolf instance on expiry. Another interval Line can require a nearby sheep, consume it, and produce a fed wolf and bones.

## Order-driven production

Represent a request for a specific product as a physical Order Item. Make a `clock-interval` Line require that Order and the recipe’s materials—for example, a corn Order, water, and seeds. Prefer gating production on the Line rather than when creating the Order. Each pulse attempts ordinary admission: if the inputs are available, work is admitted and the Order is consumed when the job starts; otherwise no request is queued, and the next interval tries again. This controls automated production without a complex queue UI.

# Lines

## Manual and Clock roles

An Item can own multiple Lines, each with its own inputs, runtime, rules, weight, and outcome; they share one queue. At most one manual Line is `default`, the initial choice for player production. `clock-interval` Lines join weighted selection at each Clock pulse. `item-termination` Lines join weighted selection when the item reaches Clock lifetime expiry or Units depletion. Visibility controls what the player sees; availability rules control what can run.

## When to use Default

Mark a Line `default` when players should be able to trigger it directly from the Board. That may be an Item’s only Line or the main thing it produces. The flag is optional; leave it unset unless direct Board activation is an intentional part of that Item’s behavior.

## Requests are not Jobs

A manual Line command records a request: no materials or Units are spent, and no runtime begins. If materials are missing, the request can wait while Tick arranges Autofill deliveries; a Job starts only after its inputs settle. `maxQueueSize` counts the active Job and pending requests across all Lines. A Clock pulse with missing inputs is skipped without leaving a request.

## Consumed and reserved materials

Use `consume` for ingredients: the committed input is destroyed when the Job completes, without spending its Units or starting a terminal line. Use `reserve` for tools or catalysts: the same Item instance and its owned state normally return to a free Board cell from the producer's current position. Reserve needs room for that return; if ordinary completion cannot place the Item, the Job remains ready for retry.
