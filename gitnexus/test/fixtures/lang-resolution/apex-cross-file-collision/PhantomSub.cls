// BL-10 heritage arm (SDD-004 §4/§8): a case-varied `extends PHANTOM` where PHANTOM is a trigger
// MIS-FILED in a .cls file (Phantom.cls) — the .cls extension passes the §3 injection discriminant,
// so the misfiled trigger IS injected under its folded key. Pre-reorder heritage resolves BEFORE
// injection, so `extends PHANTOM` misses (EXTENDS unresolved); post-reorder it binds the injected
// trigger (the ratified §1.2-(b) "globally referenceable" over-bind — dispositioned by the committed
// primary SRS BL-10 amendment). The trigger declares no members, so its MRO contributes no false
// inherited-member edge (the BL-6/BL-7-analogue MRO-downstream disposition).
public class PhantomSub extends PHANTOM {
    public void run() {
        // An implicit-this call whose name matches no member of PhantomSub NOR the trigger parent.
        // Post-reorder the trigger enters PhantomSub's MRO; the walk over [PhantomSub, Phantom-trigger]
        // must find no `ghost` and emit no edge (the trigger is memberless -> no false inherited-member
        // edge can ride the trigger-parent MRO). This gives the BL-10 MRO-downstream assertion a real
        // call site to exercise (SDD-004 §4), rather than a vacuous no-site negative.
        ghost();
    }
}
