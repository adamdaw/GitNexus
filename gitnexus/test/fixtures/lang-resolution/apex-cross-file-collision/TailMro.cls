// v1.11(b) tripwire: member lookup through TailSub's mis-bound MRO must NOT reach the
// decoy TInner's member.
public class TailMro {
    public void go() {
        TailSub t = new TailSub();
        t.decoy2();
    }
}
