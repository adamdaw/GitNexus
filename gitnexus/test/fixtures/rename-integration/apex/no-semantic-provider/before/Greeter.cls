public class Greeter {
    public static String greet() { return 'hi'; }
    public static String entry() { return greet(); }
    public static String local(String greet) { return greet; }
}
