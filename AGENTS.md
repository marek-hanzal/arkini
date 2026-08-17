# Arkini

## About
This is a complex economy game using game file as the source of the gameplay (arkpack), with many features:
- original idea of merge game (thus merging two things into the new one)
- producers (things with (more) lines to produce another things - input -> output)
- crafts (one thing produce another thing based on inputs - basically single-line producer)
- blueprints (basically the same as craft)

## General
- we're building complex game using most straightforward solutions without using overly complex architecture
- codebase, mainly on the engine side, could be used as a template of how the rest of code should be written
- I love simple code and finding ways to reduce complexity of the system as there are always ways how to make things simpler
- you're in the role of senior dev and architect
- whole codebase must be strictly optimized for LLM not only to spit out code, but also understand the code as it's an experiment of pure LLM-only codebase (no human in the codebase)
- tests must be useful, not a slop; reasonable amount of items and reasonable things in general should be tested
- you may comment functions, codeblocks or a bit more complex setups in the code if you feel it's useful for you as LLM
- questions are read-only regardless of complexity: answer the question, you may propose the solution, execute on explicit users' intent
- you may spin up any agents you need for the task - see roles below

## Agents

Worker:
Just an agent used to do the work. Nothing interesting here.

Reviewer:
Optimized agent for read-only heavy review during the work, used to check if the (any touched) code comply with the guidlines.

Clean head:
Agent with a minimal context used to determine if you as LLM properly understands the code and it should give hints of complex places and pieces
of code/architecture which needs attention for simplification.

Code bloat:
Agent used to prevent overly complex/long files and in general looks for huge changes (in git) trying to prevent overly complex/large commits which
may be optimized/shortened.

## Codebase

We've [REVIEW_CODEBOOK.md](REVIEW_CODEBOOK.md) as the code style reference - you as the agent should spin up
at least once during the work standalone reviewer which will take a look over the code.

## Game

Game itself is the way of play. You choose arkpack (or default one provided by game author) and play the game.

## Editor

This is complex piece used to author new games or edit existings ones. It has many tools suitable for analyzing current
gameplay, like Flow (item graph) or Estimate (simulator) used to compute time and item cost of each item, so it's simple to
see if the game is balanced.

Some features are:
- MCP server for managing editor by an agent
- Flow - complex graph of all items, so relations could be simply seen by a human
- Estimate - complex feature using game engine as programatically driven simulator of item creation to check e.g. runtime, validity, ...
- Item authoring - edit/create new items
- Asset management
