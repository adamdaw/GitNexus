// REQ-012 parity: exercises the peer-equivalent resolution shapes at Java/Kotlin tier — a
// cross-file constructor + call, a cross-file field access via a bare declared-type binding
// (which emits NO standalone edge — REQ-012's no-edge arm, REQ-005/REQ-011 v1.3/v1.4), an
// exact-case cross-file `implements`, and the WI-4 receiver-VARIABLE case-fold (§1(4)).
public class PApp implements PIface {
    public void run() {
        PEngine e = new PEngine();   // cross-file constructor -> CALLS
        e.start();                   // cross-file method call -> CALLS
        PEngine held = e;            // bare declared-type usage -> NO standalone edge
        String n = held.label;       // field access enabled by the binding -> ACCESSES
        Widget a = new Widget();
        A.foo();                     // receiver-VARIABLE case-fold: A -> the variable a -> Widget.foo
    }
    public void act() {}
}
