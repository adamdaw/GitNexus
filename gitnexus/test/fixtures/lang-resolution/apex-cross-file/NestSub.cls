// Nested-parent heritage (BL-3, SRS v1.10(iii)): the dotted `Outer.Inner` superclass folds
// to `outer.inner` — no simple-name workspace key — so the EXTENDS edge stays unresolved AND
// the super arms self-loop (BL-7): super() emits nothing, super.ping() binds to NestSub's OWN
// ping, not Outer.Inner.ping. (Contrast the same-case-twin TwinSub, BL-8, whose simple-name
// superclass resolves.) Probed 2026-07-06.
public class NestSub extends Outer.Inner {
    public NestSub() {
        super();
    }
    public void ping() {}
    public void callPing() {
        super.ping();
    }
}
