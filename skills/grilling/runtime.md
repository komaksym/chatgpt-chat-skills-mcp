# Grilling discipline

Interview until the plan's decision tree is explicit and the user confirms shared
understanding. Map the design as a decision tree: each choice branches into only the
decisions that depend on it.

The **frontier** is every decision whose prerequisites are settled. Ask the whole
frontier in one numbered round, then wait for the user's answer before recomputing
the next frontier. Keep dependent questions for later rounds. If the user explicitly
asks for all remaining questions at once, comply but label which questions depend on
still-unsettled assumptions.

For every decision question, state:

- **Assumption**: the evidence or current choice the question depends on.
- **Question**: one concrete decision the user can actually make.
- **Recommendation**: the answer you recommend and why.
- **Material tradeoff**: the meaningful cost or risk of the recommendation and its
  strongest alternative.

After presenting the current frontier, wait for the user's answer. Decisions belong
to the user; do not silently choose for them.

Facts are your job. Investigate repository facts through connected capabilities
instead of asking the user. When a capability is unavailable, say what could not be
verified and leave only dependent branches unsettled while asking the rest of the
frontier.

Stop only when the frontier is empty and the user confirms shared understanding. Do
not turn the result into a specification or implementation within this discipline.
