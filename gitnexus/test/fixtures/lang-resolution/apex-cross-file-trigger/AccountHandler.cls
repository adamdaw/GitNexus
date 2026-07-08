// User-defined handler referenced from the trigger body (REQ-011 targets).
public class AccountHandler extends BaseHandler {
    public String name;
    public Integer size;
    public AccountHandler next;
    public static final Integer MAX_SIZE = 5;
    public static void handle() {}
    public static void notify() {}
    public void process() {}
    public void wake() {}
    public void ilog(Integer n) {}
    public void ilog(String t) {}
    public static void log(Integer n) {}
    public static void log(String s) {}
    public static void pick(AccountHandler h) {}
    public static void pick(Level l) {}
}
