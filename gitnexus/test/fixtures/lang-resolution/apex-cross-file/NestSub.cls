// Nested-parent heritage, NO same-named top-level type in this fixture... but Utils.cls's
// Helper share is separate; `Inner` has no top-level twin here EXCEPT nothing — v1.10(iii):
// stays unresolved (pre-hook pass; pinned limitation).
public class NestSub extends Outer.Inner {}
