// Negative: a nested type is NOT injected by bare simple name -> bare Inner stays unresolved.
public class BareInner {
    public void tryBare() {
        Inner j = new Inner();
        j.ping();
    }
}
