// Case-varied extension: the host classifies .CLS as Apex; the case-folded §3 comparison
// must still inject this class (a literal endsWith('.cls') would silently drop it).
public class Loud {
    public void shout() {}
}
