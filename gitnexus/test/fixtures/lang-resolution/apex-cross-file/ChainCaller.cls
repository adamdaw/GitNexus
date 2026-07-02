// REQ-009 cross-file per-segment chain: h.leaf (Holder) then .value (Leaf), types span files.
public class ChainCaller {
    public void walk() {
        Holder h = new Holder();
        String v = h.leaf.value;
    }
}
