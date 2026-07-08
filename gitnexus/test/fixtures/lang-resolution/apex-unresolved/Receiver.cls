// REQ-015 unresolved receiver type: a call on a variable with no inferable
// user-defined type -> no edge, no throw.
public class Receiver {
    public void use(Object x) {
        x.foo();                     // x has no inferable user-defined type -> no edge
    }
}
