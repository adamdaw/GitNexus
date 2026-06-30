// REQ-008 (ii): overloads of DIFFERENT arity; an assignable-but-not-identical
// argument (Sub assignable to Base) -> resolves to the matching-arity overload by
// arity (assignability does not block arity selection).
public class OverArity {
    public virtual class Base {}
    public class Sub extends Base {}

    public void g(Base b) {}
    public void g(Base b, Integer n) {}

    public void caller() {
        Sub s = new Sub();
        g(s);                 // arity 1 isolates g(Base); Sub assignable to Base -> resolves by arity
    }
}
