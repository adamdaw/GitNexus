// Undisambiguable ctor argument: Other matches neither CtorTarget(Integer) nor (String).
public class CtorAmb {
    public void go() {
        Other o = new Other();
        CtorTarget c = new CtorTarget(o);
    }
}
