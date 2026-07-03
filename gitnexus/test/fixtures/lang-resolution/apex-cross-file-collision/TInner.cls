// Same-tail decoy: an unrelated top-level type sharing the nested TInner's simple name.
// The dotted-tail arm's single-match guard forecloses tail-binding it (probed 2026-07-02).
public virtual class TInner {
    public void decoy() {}
    public void decoy2() {}
}
