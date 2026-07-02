// Cross-file reference to a type declared nowhere: zero edges, no throw (REQ-015/NFR-001).
public class NoTarget {
    public void go() {
        Missing m = new Missing();
        m.poke();
    }
}
