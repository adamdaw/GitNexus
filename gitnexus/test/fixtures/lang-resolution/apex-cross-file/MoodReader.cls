// Nested-enum constant access: the qualified static-member shape that IS valid Apex.
public class MoodReader {
    public void read() {
        Outer.Mood m = Outer.Mood.UP;
        Outer.Mood n = OUTER.MOOD.DOWN;
    }
}
