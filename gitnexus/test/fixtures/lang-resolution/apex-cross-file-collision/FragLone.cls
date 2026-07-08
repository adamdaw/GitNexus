// Malformed outer with a UNIQUELY-named nested fragment: error recovery re-parents it to
// Module scope (Addendum 12), so it injects and is bindable — documented behaviour.
public class FragLoneOuter {
    public class Fraglet {
        public void wave() {}
    }
    public void oops( Integer
