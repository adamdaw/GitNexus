// Static field / enum-constant via a type-name receiver, cross-file (§2 static-receiver arm).
public class StaticReader {
    public void read() {
        Integer l = Consts.MAX_SIZE;
        Color c = Color.RED;
    }
}
