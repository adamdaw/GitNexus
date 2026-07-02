// Nested-parent heritage WITH a same-tail top-level decoy (TInner.cls): the pre-hook pass
// mis-binds the decoy — SRS v1.10(iv) documented limitation (probed, Addendum 11).
public class TailSub extends TOuter.TInner {}
