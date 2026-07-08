// Static field / enum-constant via a type-name receiver, cross-file (§2 static-receiver arm).
public class StaticReader {
    public void read() {
        Integer l = Consts.MAX_SIZE;
        Integer f = CONSTS.FLOOR;
        Color c = Color.RED;
        Color c2 = COLOR.BLUE;
    }
}
