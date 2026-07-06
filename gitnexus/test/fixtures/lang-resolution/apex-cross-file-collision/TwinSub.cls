// Same-case twin heritage (BL-5, SRS v1.10(v)): two defs under the exact-case key 'Twin'
// -> the heritage pre-hook pass sees both Twin.cls + Twin.trigger and conservatively refuses,
// so EXTENDS stays unresolved. But the simple-name superclass `Twin` folds to a single
// bindings-channel workspace hit (the trigger is §3-excluded from injection), so the super
// arms RESOLVE to the parent (BL-8, like BL-1/CaseKid): super() -> Twin.Twin, super.spin() ->
// Twin.spin, NOT TwinSub's own override. Probed 2026-07-06.
public class TwinSub extends Twin {
    public TwinSub() {
        super();
    }
    public override void spin() {}
    public void callSpin() {
        super.spin();
    }
}
