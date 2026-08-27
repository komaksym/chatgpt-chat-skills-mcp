Use this only after the parent implementation workflow reaches its testing phase.

Tests observe behavior through stable public interfaces, not implementation details.
A good test survives internal refactoring because it describes what a caller can
observe. Prefer the repository's highest existing integration seam. Use a known
literal or specification example as the expected value rather than recomputing the
implementation inside the assertion.

Test only at a seam already agreed by the user, the settled ticket/specification, or
established repository test conventions. If no seam is actually agreed, state the
candidate public seam and obtain only that minimal confirmation before writing the
test.

Work in vertical tracer bullets, never horizontal batches:

1. Write one behavior test at the agreed seam.
2. Run that narrow test when an execution capability exists and observe RED.
3. Write only the minimum production change needed for that behavior.
4. Run the same narrow test and observe GREEN.
5. Continue with the next behavior slice. Keep cleanup small and behavior-preserving;
   larger refactors belong to the committed review stage.

Do not claim RED or GREEN unless the run result was observed. If no runner is
available, write or propose the test and explicitly mark RED/GREEN as not exercised.

Mock only system boundaries such as external APIs, time/randomness, or an external
database/filesystem boundary when a real test dependency is impractical. Do not mock
your own modules or internal collaborators, and do not assert internal call counts
or order. Prefer dependency injection and specific SDK-style boundary methods when a
boundary must be substituted.

Avoid side-channel verification: if the public interface can prove the behavior,
assert through that interface rather than reading internal storage directly. Avoid
tautological tests whose expected value is calculated the same way as production
code. One logical behavior per test is the default.
