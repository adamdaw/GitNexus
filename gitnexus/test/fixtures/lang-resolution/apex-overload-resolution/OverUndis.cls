// REQ-008 (iii): SAME-arity overloads of different declared types; an argument
// assignable-but-not-identical to all of them (Sub assignable to Base, not
// identical to Base or Other) -> no exact-type match -> REQ-015 unresolved, not a guess.
public class OverUndis {
    public virtual class Base {}
    public class Sub extends Base {}
    public class Other {}

    public void h(Base b) {}
    public void h(Other o) {}

    public void caller() {
        Sub s = new Sub();
        h(s);                 // no equal-arity overload matches exactly -> unresolved (REQ-015)
    }
}
