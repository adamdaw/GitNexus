// Dotted base, >2 segments / namespace-qualified (ns.HOuter.HInner): Apex user-defined nested types
// are at most two segments, so this is a managed-package namespace-qualified external reference ->
// seam state-(ii) refuse -> no EXTENDS edge, never a same-tail decoy. SDD-004 §4.
public class RNamespace extends ns.HOuter.HInner {}
