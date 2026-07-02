// User-defined handler referenced from the trigger body (REQ-011 targets).
public class AccountHandler {
    public String name;
    public Integer size;
    public static final Integer MAX_SIZE = 5;
    public static void handle() {}
    public static void notify() {}
    public void process() {}
    public static void log(Integer n) {}
    public static void log(String s) {}
    public static void pick(AccountHandler h) {}
    public static void pick(Level l) {}
}
