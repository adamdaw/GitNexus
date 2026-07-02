// Walks the cycle twice: the host field-access fixpoint must terminate (no hang/throw).
public class CycWalker {
    public void walk() {
        CycA x = new CycA();
        CycB y = x.b.a.b;
    }
}
