// NFR-001 (SDD-004 §4/§6): a case-varied cross-file heritage CYCLE — newly formable only once the
// reorder resolves case-varied cross-file bases. CycloneA extends CYCLONEB (folds to cycloneb).
// buildMro's existing bounded-iteration cap must terminate the cycle (no hang).
public virtual class CycloneA extends CYCLONEB {}
