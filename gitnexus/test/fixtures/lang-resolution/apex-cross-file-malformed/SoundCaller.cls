// NFR-001 cross-file slice: the valid cross-file ref resolves (anchor); the reference
// into the garbage sibling (Wreck) degrades to unresolved, never a throw.
public class SoundCaller {
    public void go() {
        Sound s = new Sound();
        s.fine();
        Wreck w = new Wreck();
        w.crash();
    }
}
