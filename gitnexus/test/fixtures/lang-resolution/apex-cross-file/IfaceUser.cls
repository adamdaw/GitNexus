// Interface-typed declared variable: the Predicate-1 Interface arm's observable — the
// injected Iface entry binds v's static type, enabling the member resolution.
public class IfaceUser {
    public void go() {
        Iface v = new Derived();
        v.act();
        IFACE w = new Derived();
        w.act();
    }
}
