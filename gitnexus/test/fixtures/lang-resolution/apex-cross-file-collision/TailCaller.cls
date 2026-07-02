public class TailCaller {
    public void go() {
        TOuter.TInner t = new TOuter.TInner();
        t.tping();
        TOUTER.TInner u = new TOUTER.TInner();
        u.tping();
    }
}
