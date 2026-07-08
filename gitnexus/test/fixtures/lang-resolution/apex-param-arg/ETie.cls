// REQ-008 conservative tie arm (SDD-004 §4 "duplicate-named (ambiguous) user-defined type"): an
// enclosing class owning two case-colliding nested types Amb/AMB, and a method whose parameter is
// typed by that simple name. The §1(3)(c) enclosing-scope owned-def lookup finds TWO owned defs ->
// refuses on the tie (this path is scope-local, NOT foreclosed by the workspace inject-none guard) ->
// narrowing skipped -> arity-only -> ambiguous -> h(p) left unresolved, never mis-bound.
public class ETie {
    public class Amb {}
    public class AMB {}
    public void useAmb(Amb p) {
        DBox b = new DBox();
        b.h(p);
    }
}
