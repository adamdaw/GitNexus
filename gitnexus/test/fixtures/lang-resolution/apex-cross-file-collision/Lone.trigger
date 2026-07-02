// Correctly-filed trigger with NO same-named class: its unique exact-case key is bindable
// (REQ-004 v1.6 corrected exception, probed 2026-07-02).
trigger Lone on Account (before insert) {
    Integer x = 1;
}
