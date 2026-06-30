// REQ-005 forward (out-of-source-order) reference + self/recursive reference.
// Apex resolution is declaration-order-independent (host populate-then-resolve):
// caller() references helper()/recurse() declared later in the same unit.
public class Forward {
    public void caller() {
        helper();          // forward ref: helper declared below -> CALLS helper
        this.recurse();    // self reference -> CALLS recurse on enclosing type
    }

    public void helper() {}
    public void recurse() {}
}
