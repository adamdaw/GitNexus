// Malformed outer with a nested type: error recovery erases the outer scope and re-parents
// Frag's scope to Module (probed, Addendum 12) — the fragment is selected and collides with
// the valid top-level Frag (SRS v1.9 limitation).
public class FragBroken {
    public class Frag {
        public void fake() {}
    }
    public void oops( Integer
