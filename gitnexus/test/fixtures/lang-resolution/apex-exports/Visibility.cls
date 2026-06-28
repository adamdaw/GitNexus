global class Visibility {
    global Integer gField;
    public Integer pubField;
    protected Integer protField;
    private Integer privField;
    Integer defField;

    webservice static void wsMethod() {}
    public void pubMethod() {}
    private void privMethod() {}

    public enum Mood {
        HAPPY,
        SAD
    }

    private enum Secret {
        HIDDEN
    }

    public class Nested {
        public Integer x;
    }

    class NoModNested {
        public Integer y;
    }
}
