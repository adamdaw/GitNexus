// Doubly-varied qualified nested access: outer folding (§7(13)) ∘ tail folding (§7(5)) —
// the composition of the two reliance-backed mechanisms, not assumed free.
public class DoubleCase {
    public void reach() {
        OUTER.INNER e = new OUTER.INNER();
        e.ping();
    }
}
