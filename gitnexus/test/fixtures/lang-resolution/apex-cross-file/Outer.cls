public virtual class Outer {
    public virtual class Inner {
        public void ping() {}
    }
    // Valid nested/top-level name share: a top-level `class Helper` lives in Utils.cls.
    // The owning-scope discriminant must select only the top-level one (§4 name-share case).
    public class Helper {
        public void fake() {}
    }
    public enum Mood { UP, DOWN }
}
