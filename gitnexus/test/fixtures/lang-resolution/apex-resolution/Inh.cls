// REQ-007 nested-type inheritance (the only inheritance reachable within a single
// declaration unit; top-level extends/implements is inherently cross-file -> WI-3)
// + REQ-005 delegation sub-clause (this()/super()/super.method()).
// SDD-002 §2 REQ-007 in-unit form: `class Outer { virtual class Base {} class Derived extends Base {} }`.
public class Inh {
    public virtual class Base {
        public Base() {}
        public Base(Integer x) { this(); }     // this() -> sibling constructor (intra-type)
        public virtual void greet() {}
    }

    public class Derived extends Base {         // EXTENDS Base (nested)
        public Derived() { super(); }           // super() -> parent ctor (nested parent = in-unit)
        public override void greet() {
            super.greet();                       // super.method() -> parent member
        }
    }

    public interface Greeter {
        void greet();
    }

    public interface SubGreeter extends Greeter {}  // interface-extends-interface (nested) -> IMPLEMENTS Greeter

    public class Impl implements Greeter {}     // IMPLEMENTS Greeter (nested)
}
