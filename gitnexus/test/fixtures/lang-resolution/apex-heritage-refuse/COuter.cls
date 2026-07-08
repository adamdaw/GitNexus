// One arm of a case-colliding OUTER twin (COuter / couter both fold to 'couter'): SDD-003 §3's
// inject-none guard registers NEITHER, so the folded OUTER key has 0 workspace candidates. COuter
// owns a nested CInner (irrelevant once the OUTER is inject-none-suppressed).
public virtual class COuter {
    public virtual class CInner {}
}
