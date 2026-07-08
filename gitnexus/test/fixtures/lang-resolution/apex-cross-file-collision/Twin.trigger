// VALID Apex: a trigger and a class may share a simple name (SDD-001 §4 pair).
trigger Twin on Account (before insert) {
    Integer x = 1;
}
