// REQ-008 completion, conservative arm: a parameter typed EXTERNAL (String) -> the §1(3) oracle
// finds no unique user-defined resolution -> narrowing is skipped -> arity-only -> the two arity-1
// overloads f(Widget)/f(String) survive -> ambiguous -> left unresolved, NEVER mis-bound to
// f(Widget). (WI-4 narrows on a positive user-defined test, not an external classifier — SDD-004
// §1(3)/§2.)
public class ParamExtCaller {
    public void callExt(String s) {
        PBox b = new PBox();
        b.f(s);
    }
}
