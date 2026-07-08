// Overload sets on a top-level type in its own file: REQ-008 narrowing composes with
// REQ-010 global receiver resolution (the dominant real-world Apex case).
public class Target {
    public void fLocal(Integer n) {}
    public void fLocal(String s) {}
    public void fLit(Integer n) {}
    public void fLit(String s) {}
    public void fCtor(Widget w) {}
    public void fCtor(Gadget g) {}
    public void fField(Widget w) {}
    public void fField(Gadget g) {}
    public static void sf(Integer n) {}
    public static void sf(String s) {}
    public void amb(Widget w) {}
    public void amb(Gadget g) {}
}
