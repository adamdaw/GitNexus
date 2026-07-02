// A TRIGGER misfiled in a .cls file (invalid Apex): the extension discriminant cannot
// exclude it, so it IS injected — documented §A.13 limitation (mirror of Rogue.trigger).
trigger Phantom on Account (before insert) {
    Integer x = 1;
}
