// Case-varied reference: resolves only via the folded-key injection, which must not
// contain Boom (the case-folded extension exclusion).
public class BoomCaller {
    public void go() {
        BOOM b = new BOOM();
    }
}
