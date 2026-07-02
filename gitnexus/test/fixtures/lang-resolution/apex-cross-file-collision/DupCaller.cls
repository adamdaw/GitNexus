// The Dupe reference must stay unresolved (never mis-bound); Solo anchors the fixture red.
public class DupCaller {
    public void go() {
        Dupe d = new Dupe();
        d.hit();
        Solo s = new Solo();
        s.ok();
    }
}
