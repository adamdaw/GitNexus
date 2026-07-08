// NFR-001 §4 "partial / error-recovery tree — a reference INSIDE a malformed unit":
// the reference x.d( is in an unterminated (error-recovery) region. Resolution must
// conservatively skip it -> no throw, run completes, no dangling edge.
public class PartialRef {
    public class Dep {
        public void d() {}
    }

    public void use() {
        Dep x = new Dep();
        x.d(
    }
}
