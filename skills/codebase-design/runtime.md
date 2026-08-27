# Codebase-design discipline

Use one canonical architecture vocabulary for deep-module design:

- Module: anything with one caller-visible interface and an implementation.
- Interface: everything a caller must know to use the module correctly, including invariants, ordering, errors, configuration, and performance characteristics.
- Depth: leverage at the interface; a deep module puts substantial behavior behind a small interface, while a shallow module exposes nearly as much complexity as it contains.
- Seam: the location where behavior can vary without editing the caller; this is where a module's interface lives.
- Adapter: a concrete thing that satisfies an interface at a seam. Use adapter for the role at a seam and implementation for what is inside it.
- Leverage: capability callers gain per unit of interface they must learn.
- Locality: the concentration of change, bugs, knowledge, and verification behind one interface.

Use these terms exactly. Avoid substituting component, service, API, boundary, or signature when the architecture concept above is intended.

## Principles

- Depth is a property of the interface, not a line-count ratio.
- Apply the deletion test: if deleting the module only makes complexity reappear across callers, the module is earning its keep; if complexity vanishes, it was probably pass-through structure.
- The interface is the test surface. Callers and behavior tests should cross the same seam; reaching past it is evidence the module may be the wrong shape.
- One adapter means a hypothetical seam; two adapters means a real one. Do not add variability that the repository does not need.
- Prefer small interfaces that accept dependencies instead of constructing external dependencies internally.
- Prefer results that callers can observe through the interface over hidden side effects.

When comparing architecture directions, prefer the one that gives callers more leverage and maintainers more locality without inventing seams or adapters.
Treat canonical domain vocabulary and existing ADRs as design inputs, not decoration.

Child exploration or alternative-design work is optional. Use a child only when it has direct GitHub access to the repository evidence it must inspect; otherwise do the comparison in the current conversation and label no work as independently explored.
