// Case-varied qualified nested access: OUTER folds to Outer's global key, .Inner resolves
// as a member of it (§8 case-varied nested-qualified form).
public class CaseNested {
    public void reach() {
        OUTER.Inner c = new OUTER.Inner();
        c.ping();
    }
}
