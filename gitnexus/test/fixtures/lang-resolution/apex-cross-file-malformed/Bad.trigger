// Trigger with a partial / error-recovery body: conservative skip, no throw (NFR-001).
trigger Bad on Account (before insert) {
    Sound s2 = new Sound();
    s2.
