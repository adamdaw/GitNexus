// Overloaded target whose exact-type arm is the NESTED type NOuter.NInner.
public class NBox {
    public void g(NOuter.NInner n) {}
    public void g(String s) {}
}
