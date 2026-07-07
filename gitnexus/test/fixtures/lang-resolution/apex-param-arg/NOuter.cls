// Nested user-defined type for the REQ-008 nested-parameter arms.
public class NOuter {
    public class NInner {}

    // §1(3)(c): a parameter typed by the SIMPLE-name nested type NInner, referenced UNQUALIFIED
    // from within its enclosing class NOuter -> the enclosing-scope owned-def lookup narrows
    // g(NOuter.NInner). ([Gate-3 reliance] arm — SDD-004 §1(3)(c).)
    public void callInnerFromEnclosing(NInner p) {
        NBox b = new NBox();
        b.g(p);
    }
}
