// Interface-typed DECLARATION-ONLY variables: isolates the Interface workspace entry
// from constructor-type inference (the discriminated Predicate-1 Interface observable).
public class IfaceUser {
    public Iface v;
    public IFACE w;
    public void go() {
        v.act();
        w.act();
    }
}
