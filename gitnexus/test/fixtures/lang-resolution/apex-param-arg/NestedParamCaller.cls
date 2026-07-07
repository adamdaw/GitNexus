// §1(3)(b): a parameter typed by the DOTTED nested type NOuter.NInner -> the inc-11 OUTER-first
// nested lookup narrows to g(NOuter.NInner), NEVER the same-tail top-level decoy NInner (which is
// a distinct type and would not exact-match the g(NOuter.NInner) overload). SDD-004 §1(3)(b).
public class NestedParamCaller {
    public void callNested(NOuter.NInner p) {
        NBox b = new NBox();
        b.g(p);
    }
}
