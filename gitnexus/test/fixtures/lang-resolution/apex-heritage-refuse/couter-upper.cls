// One arm of a case-colliding OUTER twin (COuter / couter both fold to 'couter'): SDD-003 §3's
// inject-none guard registers NEITHER, so the folded OUTER key has 0 workspace candidates. COuter
// owns a nested CInner (irrelevant once the OUTER is inject-none-suppressed).
// Filename is couter-upper.cls (not COuter.cls) so this twin can coexist with couter-lower.cls on
// case-insensitive filesystems (macOS/Windows). The resolver folds the AST class name, not the
// filename, so the COuter/couter collision is unaffected by the rename.
public virtual class COuter {
    public virtual class CInner {}
}
