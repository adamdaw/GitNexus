// Dotted base, case-collided OUTER (COuter.CInner where COuter/couter collide -> inject-none -> 0
// workspace candidates): the OUTER is not a unique workspace type -> seam state-(ii) refuse -> no
// EXTENDS edge, and NEVER the same-tail top-level decoy CInner (the BL-4 guard holds for a
// case-collided OUTER too, not only a uniquely-bound one). SDD-004 §4 / Addendum 5.
public class RCollidedOuter extends COuter.CInner {}
