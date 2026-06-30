// REQ-015 resolved-receiver-but-absent-member: the receiver resolves to a
// user-defined type, but the named member does not exist on it -> no edge,
// recorded unresolved ("no match"), no throw. `real()` is the resolve anchor.
public class Absent {
    public class Thing {
        public void real() {}
    }

    public void use() {
        Thing t = new Thing();
        t.real();                    // anchor: resolves (CALLS real)
        t.missing();                 // absent member -> unresolved, no edge, no throw
    }
}
