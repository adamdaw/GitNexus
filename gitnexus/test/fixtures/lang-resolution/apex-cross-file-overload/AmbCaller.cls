// Undisambiguable cross-file overload: arg typed Other matches neither candidate at
// equal arity -> conservative unresolved + recorded (REQ-015 ∘ REQ-010).
public class AmbCaller {
    public void callAmb() {
        Target t = new Target();
        Other o = new Other();
        t.amb(o);
    }
}
