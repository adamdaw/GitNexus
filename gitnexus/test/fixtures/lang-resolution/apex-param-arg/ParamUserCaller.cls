// REQ-008 completion: a parameter typed as a USER-DEFINED top-level type (Widget) used as the
// disambiguating overload argument -> the §1(3)(a) oracle (workspaceFqnBindings folded membership)
// recognizes it as user-defined and narrows to f(Widget). RED until WI-4 gates the narrowing.
public class ParamUserCaller {
    public void callUser(Widget p) {
        PBox b = new PBox();
        b.f(p);
    }
}
