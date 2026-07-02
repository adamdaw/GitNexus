// Case-variant twin of TWIST.cls (valid Apex): pre-impl the exact-case channel binds the
// TRIGGER for `new Twist()` (probed, Addendum 8) — committed to fix at WI-3 (§7(11) safety).
trigger Twist on Account (before insert) {
    Integer x = 1;
}
