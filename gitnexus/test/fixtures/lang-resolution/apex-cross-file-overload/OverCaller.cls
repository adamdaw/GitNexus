// One call site per WI-2-supported disambiguating-argument kind, reached cross-file:
// local variable, literal, constructor expression, field-typed (this.w). Plus the
// static type-name receiver Target.sf(...) — the shared static-receiver reliance.
public class OverCaller {
    public Widget w;
    public void callLocal() {
        Integer x = 1;
        Target t = new Target();
        t.fLocal(x);
    }
    public void callLit() {
        new Target().fLit(42);
    }
    public void callCtor() {
        Target t = new Target();
        t.fCtor(new Widget());
    }
    public void callField() {
        Target t = new Target();
        t.fField(this.w);
    }
    public void callStatic() {
        Target.sf(7);
    }
}
