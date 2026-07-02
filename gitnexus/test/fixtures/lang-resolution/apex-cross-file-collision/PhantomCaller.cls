// Case-varied reference: resolves only via the folded-key injection, so it pins the
// limitation (the misfiled trigger def is globally referenceable post-injection).
public class PhantomCaller {
    public void go() {
        PHANTOM p = new PHANTOM();
    }
}
