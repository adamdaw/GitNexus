// REQ-008 (i) exact-type narrowing and (iv) multi-parameter narrowing,
// single declaration unit. Arity-then-exact-type; no assignability ranking (SRS v1.2).
public class Over {
    public void f(Integer a) {}
    public void f(String a) {}

    public void m(Integer a, String b) {}
    public void m(String a, Integer b) {}

    public void callExact() {
        Integer x = 0;
        f(x);                 // (i) -> f(Integer) by exact type
    }

    public void callMulti() {
        Integer a = 0;
        String b = '';
        m(a, b);              // (iv) all positions identical -> m(Integer, String)
    }

    public void callMultiNeg() {
        Integer a = 0;
        Boolean b = false;
        m(a, b);              // (iv-neg) identical to neither overload at every position -> REQ-015 unresolved
    }
}
