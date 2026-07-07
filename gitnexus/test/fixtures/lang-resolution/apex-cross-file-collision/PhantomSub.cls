// BL-10 heritage arm (SDD-004 §4/§8): a case-varied `extends PHANTOM` where PHANTOM is a trigger
// MIS-FILED in a .cls file (Phantom.cls) — the .cls extension passes the §3 injection discriminant,
// so the misfiled trigger IS injected under its folded key. Pre-reorder heritage resolves BEFORE
// injection, so `extends PHANTOM` misses (EXTENDS unresolved); post-reorder it binds the injected
// trigger (the ratified §1.2-(b) "globally referenceable" over-bind — dispositioned by the committed
// primary SRS BL-10 amendment). The trigger declares no members, so its MRO contributes no false
// inherited-member edge (the BL-6/BL-7-analogue MRO-downstream disposition).
public class PhantomSub extends PHANTOM {
    public void run() {}
}
