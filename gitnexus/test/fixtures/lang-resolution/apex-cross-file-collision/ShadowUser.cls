// Local-shadows-global: the nested Shadow wins over the injected global Shadow.
public class ShadowUser {
    public class Shadow {
        public void ping() {}
    }
    public void use() {
        Shadow s = new Shadow();
        s.ping();
    }
}
