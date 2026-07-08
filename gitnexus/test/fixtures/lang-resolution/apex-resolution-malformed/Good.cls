// NFR-001 resolution-stage slice: a valid unit whose intra-unit reference resolves
// (anchor) and whose reference INTO a malformed/skipped sibling file is left
// unresolved without a throw. The run completes.
public class Good {
    public class Helper {
        public void help() {}
    }

    public void use() {
        Helper h = new Helper();
        h.help();                    // resolves (anchor)
        Broken b = new Broken();     // Broken's file is malformed/skipped -> unresolved, no throw
    }
}
