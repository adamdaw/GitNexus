// Nested-type qualified access from another file: Outer resolves globally, .Inner as member.
public class NestedCaller {
    public void reach() {
        Outer.Inner i = new Outer.Inner();
        i.ping();
    }
}
