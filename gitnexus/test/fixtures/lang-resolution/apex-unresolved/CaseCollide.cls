// REQ-015 ambiguous / case-only collision: two members differing only in case
// (illegal-to-compile Apex; GitNexus graphs uncompiled source). A reference that
// matches both case-insensitively -> no single target -> no edge AND recorded
// unresolved (the host's `suppressed` ResolutionOutcome), never mis-bound.
public class CaseCollide {
    public class Bag {
        public String value { get; set; }
        public String VALUE { get; set; }
    }

    public void use() {
        Bag b = new Bag();
        String v = b.Value;          // matches both `value` and `VALUE` -> ambiguous
    }
}
