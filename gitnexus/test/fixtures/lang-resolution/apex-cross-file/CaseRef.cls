// Case-varied cross-file reference: folds to Engine's global key (§2.2 seam ∘ REQ-010).
public class CaseRef {
    public void poke() {
        ENGINE e = new ENGINE();
        e.STOP();
    }
}
