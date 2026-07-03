// A trigger misfiled in a .cls file, sharing Victim's folded name (v1.11(c)): it enters
// the injection universe and poisons the valid class's key.
trigger Victim on Account (before insert) {
    Integer x = 1;
}
