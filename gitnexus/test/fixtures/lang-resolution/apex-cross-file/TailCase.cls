// Tail-varied qualified nested access: the member segment folds (§7(5) fold-extended
// fallback) — the third case dimension of the qualified form.
public class TailCase {
    public void reach() {
        Outer.INNER d = new Outer.INNER();
        d.ping();
    }
}
