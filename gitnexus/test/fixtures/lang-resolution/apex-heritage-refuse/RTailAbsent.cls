// Dotted base, OUTER binds but the nested tail is ABSENT (HOuter owns no Ghost), with a same-tail
// top-level decoy Ghost present: seam state-(ii) refuse -> no EXTENDS edge, never the decoy (the exact
// BL-4 near-miss regression the seam prevents). SDD-004 §4.
public class RTailAbsent extends HOuter.Ghost {}
