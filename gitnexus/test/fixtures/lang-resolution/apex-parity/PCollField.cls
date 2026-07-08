// Gate-5 mutation-kill fixture (M6 — SDD-004 §4 receiver-variable fold, "don't guess"): a fold
// COLLISION at method scope must REFUSE, and must NOT fall through to a same-folded binding at the
// ENCLOSING class scope. Method-local `rc`:Widget and `RC`:Gadget both fold to 'rc'; the receiver
// `Rc` exact-matches neither (so it reaches the folded fallback) and folds to 'rc' -> an ambiguous
// method-scope collision -> conservative skip (no CALLS edge). The class field `rC`:Widget also folds
// to 'rc': a mutant that keeps scanning outer scopes on a collision (instead of refusing at the
// collision) would wrongly bind it -> Rc.foo() => Widget.foo. This fixture pins the refuse: NO foo
// edge from PCollField. (Invalid Apex — duplicate local — exercised for conservative behaviour, as
// with PColl.)
public class PCollField {
    Widget rC;
    public void go() {
        Widget rc = new Widget();
        Gadget RC = new Gadget();
        Rc.foo();
    }
}
