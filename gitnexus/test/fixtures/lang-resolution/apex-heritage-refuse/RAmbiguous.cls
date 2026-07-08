// Dotted base, uniquely-bound OUTER owning an AMBIGUOUS (case-colliding) nested tail (HOuter owns
// Dup + DUP): the nested lookup refuses on the tie (mirrors REQ-015 / resolveQualifiedInheritanceBase
// refuse-on-tie) -> no EXTENDS edge, never a guess. SDD-004 §4/§7 (the ambiguous-nested fixture).
public class RAmbiguous extends HOuter.Dup {}
