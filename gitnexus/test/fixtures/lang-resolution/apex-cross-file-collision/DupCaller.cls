// The Dupe reference must stay unresolved (never mis-bound); Solo anchors the fixture red.
public class DupCaller {
    public void go() {
        Dupe d = new Dupe();
        d.hit();
        dupe cv = new dupe();
        Solo s = new Solo();
        s.ok();
    }
}
